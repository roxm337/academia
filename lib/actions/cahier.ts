"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, teacherOwning } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { storeUpload, DOC_TYPES } from "@/lib/storage";
import { dayStart, parseDay } from "@/lib/data/attendance";
import type { ActionState } from "@/lib/actions/structure";

const entrySchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
});

/**
 * Log (or edit) a cahier-de-textes entry — what was covered in a lesson. Only
 * the teacher assigned to the class+subject may write it. When a timetable
 * session exists for that class/subject on that day, the entry is linked to it
 * (the schema keeps one entry per session).
 */
export async function saveCahierEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const teacherId = await teacherOwning(actor.id, d.classId, d.subjectId);
  if (!teacherId) return { error: "notAllowed" };

  const day = parseDay(d.date);
  if (!day) return { error: "invalid" };
  const date = dayStart(day);

  let entryId = d.id;
  if (d.id) {
    const before = await prisma.cahierEntry.findUnique({ where: { id: d.id } });
    if (!before || before.teacherId !== teacherId) return { error: "notAllowed" };
    await prisma.cahierEntry.update({
      where: { id: d.id },
      data: { date, title: d.title, description: d.description },
    });
  } else {
    // Link to the day's session for this class+subject, if free.
    const session = await prisma.session.findFirst({
      where: { classId: d.classId, subjectId: d.subjectId, date },
      select: { id: true },
    });
    let sessionId: string | null = null;
    if (session) {
      const taken = await prisma.cahierEntry.findUnique({
        where: { sessionId: session.id },
        select: { id: true },
      });
      if (!taken) sessionId = session.id;
    }
    const created = await prisma.cahierEntry.create({
      data: {
        classId: d.classId, subjectId: d.subjectId, teacherId,
        date, title: d.title, description: d.description, sessionId,
      },
    });
    entryId = created.id;
  }

  // Optional attachment.
  const file = formData.get("file");
  if (file instanceof File && file.size > 0 && entryId) {
    const up = await storeUpload(file, {
      uploadedById: actor.id,
      folder: `cahier/${entryId}`,
      allowed: DOC_TYPES,
    });
    if (!up.ok) return { error: up.error };
    await prisma.attachment.create({ data: { fileId: up.fileId, cahierEntryId: entryId } });
  }

  await audit({
    actorId: actor.id,
    action: d.id ? "CAHIER_UPDATE" : "CAHIER_CREATE",
    entity: "CahierEntry",
    entityId: entryId!,
  });

  revalidatePath("/[locale]/(dashboard)/teacher/cahier", "page");
  return { ok: true };
}

export async function deleteCahierEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  const entry = await prisma.cahierEntry.findUnique({ where: { id } });
  if (!entry) return { error: "notFound" };
  if (!(await teacherOwning(actor.id, entry.classId, entry.subjectId))) {
    return { error: "notAllowed" };
  }

  await prisma.cahierEntry.delete({ where: { id } });
  await audit({
    actorId: actor.id,
    action: "CAHIER_DELETE",
    entity: "CahierEntry",
    entityId: id,
  });

  revalidatePath("/[locale]/(dashboard)/teacher/cahier", "page");
  return { ok: true };
}
