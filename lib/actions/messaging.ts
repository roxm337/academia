"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getSchoolSettings } from "@/lib/school";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { storeUpload, DOC_TYPES } from "@/lib/storage";
import type { SessionUser } from "@/lib/dal";
import type { ActionState } from "@/lib/actions/structure";

type ThreadKind = "PARENT_TEACHER" | "PARENT_ADMIN";

/**
 * Whether `actor` may message `recipientId`, and under which thread kind — the
 * authoritative check, recomputed here rather than trusted from the form.
 * Parent↔admin is always open; parent↔teacher needs the school setting AND a
 * real teaches-your-child relationship.
 */
async function canMessage(
  actor: SessionUser,
  recipientId: string,
): Promise<ThreadKind | null> {
  if (actor.id === recipientId) return null;
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { role: true },
  });
  if (!recipient) return null;

  if (actor.role === "PARENT" && recipient.role === "DIRECTOR") return "PARENT_ADMIN";
  if (actor.role === "DIRECTOR" && recipient.role === "PARENT") return "PARENT_ADMIN";

  const settings = await getSchoolSettings();
  if (!(settings?.allowTeacherParentMessaging ?? true)) return null;

  const parentId =
    actor.role === "PARENT" ? actor.id : recipient.role === "PARENT" ? recipientId : null;
  const teacherUserId =
    actor.role === "TEACHER" ? actor.id : recipient.role === "TEACHER" ? recipientId : null;
  if (!parentId || !teacherUserId) return null;

  const rel = await prisma.teacherAssignment.findFirst({
    where: {
      teacher: { userId: teacherUserId },
      class: {
        enrollments: {
          some: { isActive: true, student: { guardians: { some: { guardian: { userId: parentId } } } } },
        },
      },
    },
    select: { id: true },
  });
  return rel ? "PARENT_TEACHER" : null;
}

const startSchema = z.object({
  recipientId: z.string().min(1),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
});

export async function startThread(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { recipientId, subject, body } = parsed.data;

  const kind = await canMessage(actor, recipientId);
  if (!kind) return { error: "notAllowed" };

  const now = new Date();
  const thread = await prisma.messageThread.create({
    data: {
      kind,
      subject,
      participants: {
        create: [
          { userId: actor.id, lastReadAt: now },
          { userId: recipientId },
        ],
      },
      messages: { create: { senderId: actor.id, body } },
    },
  });

  await notifyMany([recipientId], {
    type: "MESSAGE",
    titleAr: "رسالة جديدة", titleFr: "Nouveau message",
    bodyAr: subject, bodyFr: subject,
    link: "/parent/messages",
  });

  await audit({ actorId: actor.id, action: "THREAD_CREATE", entity: "MessageThread", entityId: thread.id });
  revalidatePath("/[locale]/(dashboard)/parent/messages", "page");
  revalidatePath("/[locale]/(dashboard)/teacher/messages", "page");
  revalidatePath("/[locale]/(dashboard)/director/messages", "page");
  return { ok: true };
}

const sendSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

export async function sendMessage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = sendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { threadId, body } = parsed.data;

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: { participants: { select: { userId: true } } },
  });
  if (!thread || !thread.participants.some((p) => p.userId === actor.id)) {
    return { error: "notAllowed" };
  }

  const now = new Date();
  const message = await prisma.message.create({
    data: { threadId, senderId: actor.id, body },
  });

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const up = await storeUpload(file, { uploadedById: actor.id, folder: `messages/${message.id}`, allowed: DOC_TYPES });
    if (!up.ok) return { error: up.error };
    await prisma.attachment.create({ data: { fileId: up.fileId, messageId: message.id } });
  }

  await prisma.$transaction([
    prisma.messageThread.update({ where: { id: threadId }, data: { updatedAt: now } }),
    prisma.threadParticipant.update({
      where: { threadId_userId: { threadId, userId: actor.id } },
      data: { lastReadAt: now },
    }),
  ]);

  const others = thread.participants.map((p) => p.userId).filter((id) => id !== actor.id);
  await notifyMany(others, {
    type: "MESSAGE",
    titleAr: "رسالة جديدة", titleFr: "Nouveau message",
    bodyAr: thread.subject, bodyFr: thread.subject,
    link: "/parent/messages",
  });

  revalidatePath("/[locale]/(dashboard)/parent/messages/[id]", "page");
  revalidatePath("/[locale]/(dashboard)/teacher/messages/[id]", "page");
  revalidatePath("/[locale]/(dashboard)/director/messages/[id]", "page");
  return { ok: true };
}

/** Mark a thread read for the caller (called when the transcript is on screen). */
export async function markThreadRead(threadId: string): Promise<void> {
  const user = await verifySession();
  const participant = await prisma.threadParticipant.findUnique({
    where: { threadId_userId: { threadId, userId: user.id } },
    select: { threadId: true },
  });
  if (!participant) return;
  await prisma.threadParticipant.update({
    where: { threadId_userId: { threadId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });
}
