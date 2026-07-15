"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { storeUpload, DOC_TYPES } from "@/lib/storage";
import { audienceNeedsTarget } from "@/lib/announcements";
import type { ActionState } from "@/lib/actions/structure";

const schema = z.object({
  id: z.string().optional(),
  titleAr: z.string().trim().min(1).max(200),
  titleFr: z.string().trim().min(1).max(200),
  bodyAr: z.string().trim().min(1).max(4000),
  bodyFr: z.string().trim().min(1).max(4000),
  audience: z.enum(["WHOLE_SCHOOL", "CYCLE", "LEVEL", "CLASS", "TEACHERS", "PARENTS"]),
  cycleId: z.string().optional(),
  levelId: z.string().optional(),
  classId: z.string().optional(),
  isPublished: z.enum(["on"]).optional(),
});

/** Only the director and the surveillant may broadcast announcements. */
export async function saveAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR", "SURVEILLANT");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  // A targeted audience must carry its target; the rest are cleared.
  const need = audienceNeedsTarget(d.audience);
  const cycleId = d.audience === "CYCLE" ? d.cycleId || null : null;
  const levelId = d.audience === "LEVEL" ? d.levelId || null : null;
  const classId = d.audience === "CLASS" ? d.classId || null : null;
  if (need === "cycle" && !cycleId) return { error: "targetRequired" };
  if (need === "level" && !levelId) return { error: "targetRequired" };
  if (need === "class" && !classId) return { error: "targetRequired" };

  const data = {
    titleAr: d.titleAr, titleFr: d.titleFr, bodyAr: d.bodyAr, bodyFr: d.bodyFr,
    audience: d.audience, cycleId, levelId, classId,
    isPublished: d.isPublished === "on",
  };

  let id = d.id;
  if (d.id) {
    const before = await prisma.announcement.findUnique({ where: { id: d.id } });
    if (!before) return { error: "notFound" };
    await prisma.announcement.update({ where: { id: d.id }, data });
  } else {
    const created = await prisma.announcement.create({
      data: { ...data, authorId: actor.id, publishAt: new Date() },
    });
    id = created.id;
  }

  const file = formData.get("file");
  if (file instanceof File && file.size > 0 && id) {
    const up = await storeUpload(file, { uploadedById: actor.id, folder: `announcements/${id}`, allowed: DOC_TYPES });
    if (!up.ok) return { error: up.error };
    await prisma.attachment.create({ data: { fileId: up.fileId, announcementId: id } });
  }

  await audit({
    actorId: actor.id,
    action: d.id ? "ANNOUNCEMENT_UPDATE" : "ANNOUNCEMENT_CREATE",
    entity: "Announcement",
    entityId: id!,
  });

  revalidatePath("/[locale]/(dashboard)/director/announcements", "page");
  revalidatePath("/[locale]/(dashboard)/surveillant/announcements", "page");
  return { ok: true };
}

export async function deleteAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR", "SURVEILLANT");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };
  const before = await prisma.announcement.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };

  await prisma.announcement.delete({ where: { id } });
  await audit({ actorId: actor.id, action: "ANNOUNCEMENT_DELETE", entity: "Announcement", entityId: id });
  revalidatePath("/[locale]/(dashboard)/director/announcements", "page");
  revalidatePath("/[locale]/(dashboard)/surveillant/announcements", "page");
  return { ok: true };
}

/**
 * Mark announcements read for the current user (called from the reader feed once
 * it's on screen). Read receipts are harmless, so this just records them without
 * re-checking audience.
 */
export async function markAnnouncementsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const user = await verifySession();
  await prisma.announcementRead.createMany({
    data: ids.map((announcementId) => ({ announcementId, userId: user.id })),
    skipDuplicates: true,
  });
}
