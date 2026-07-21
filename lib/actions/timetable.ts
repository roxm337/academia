"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { currentYear } from "@/lib/data/structure";
import { getYearSlotsForConflict } from "@/lib/data/timetable";
import { WEEKDAYS, detectConflicts, type SlotShape } from "@/lib/timetable";
import type { ActionState } from "@/lib/actions/structure";

/**
 * A save can fail with a *reason the director must see* — "the teacher is
 * already teaching then", "the room is taken". So the state carries the clash
 * kinds, not just a generic error. `copied`/`skipped` report a bulk copy.
 */
export type SlotState =
  | (NonNullable<ActionState> & {
      conflicts?: ("class" | "teacher" | "room")[];
      copied?: number;
      skipped?: number;
    })
  | null;

const REVALIDATE = "/[locale]/(dashboard)/director/timetable";

const slotSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().min(1),
    subjectId: z.string().min(1),
    teacherId: z.string().min(1),
    roomId: z.string().optional(),
    weekday: z.enum(WEEKDAYS),
    startMin: z.coerce.number().int().min(0).max(24 * 60),
    endMin: z.coerce.number().int().min(0).max(24 * 60),
  })
  .refine((v) => v.endMin > v.startMin, { path: ["endMin"] });

/**
 * Create or move a lesson. The role check and the conflict check both live here
 * on purpose: a Server Action is a public POST endpoint, so neither the page
 * that rendered the form nor any check the browser did can be trusted.
 */
export async function saveSlot(
  _prev: SlotState,
  formData: FormData,
): Promise<SlotState> {
  const actor = await requireRole("DIRECTOR");
  const year = await currentYear();
  if (!year) return { error: "noSchoolYear" };

  const parsed = slotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const d = parsed.data;
  const roomId = d.roomId || null;

  // The teacher must actually own this (class, subject) for the year — that is
  // the same rule the gradebook rests on, and it stops a lesson naming a
  // teacher who doesn't teach the subject.
  const owns = await prisma.teacherAssignment.findFirst({
    where: {
      classId: d.classId,
      subjectId: d.subjectId,
      teacherId: d.teacherId,
      schoolYearId: year.id,
    },
    select: { id: true },
  });
  if (!owns) return { error: "notAssigned" };

  const candidate: SlotShape = {
    id: d.id,
    weekday: d.weekday,
    startMin: d.startMin,
    endMin: d.endMin,
    classId: d.classId,
    teacherId: d.teacherId,
    roomId,
  };

  const existing = await getYearSlotsForConflict();
  const conflicts = detectConflicts(candidate, existing);
  if (conflicts.length) {
    // De-dupe kinds; the director cares "teacher busy", not that three slots say so.
    const kinds = [...new Set(conflicts.map((c) => c.kind))];
    return { error: "conflict", conflicts: kinds };
  }

  const data = {
    schoolYearId: year.id,
    classId: d.classId,
    subjectId: d.subjectId,
    teacherId: d.teacherId,
    roomId,
    weekday: d.weekday,
    startMin: d.startMin,
    endMin: d.endMin,
  };

  const before = d.id
    ? await prisma.timetableSlot.findUnique({ where: { id: d.id } })
    : null;

  const slot = d.id
    ? await prisma.timetableSlot.update({ where: { id: d.id }, data })
    : await prisma.timetableSlot.create({ data });

  await audit({
    actorId: actor.id,
    action: d.id ? "SLOT_UPDATE" : "SLOT_CREATE",
    entity: "TimetableSlot",
    entityId: slot.id,
    before,
    after: slot,
  });

  revalidatePath(REVALIDATE, "page");
  return { ok: true };
}

export async function deleteSlot(
  _prev: SlotState,
  formData: FormData,
): Promise<SlotState> {
  const actor = await requireRole("DIRECTOR");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  const before = await prisma.timetableSlot.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };

  await prisma.timetableSlot.delete({ where: { id } });

  await audit({
    actorId: actor.id,
    action: "SLOT_DELETE",
    entity: "TimetableSlot",
    entityId: id,
    before,
  });

  revalidatePath(REVALIDATE, "page");
  return { ok: true };
}


const moveSchema = z.object({
  id: z.string().min(1),
  weekday: z.enum(WEEKDAYS),
  startMin: z.coerce.number().int().min(0).max(24 * 60),
  endMin: z.coerce.number().int().min(0).max(24 * 60),
});

/**
 * Drop a lesson into a different cell.
 *
 * Only the destination comes from the client. Class, subject, teacher, room
 * are re-read from the stored slot — a drag says "put this here",
 * never "and also change who teaches it". The same conflict engine as the form
 * runs, so dragging cannot create a clash the form would have refused.
 */
export async function moveSlot(
  _prev: SlotState,
  formData: FormData,
): Promise<SlotState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = moveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  if (d.endMin <= d.startMin) return { error: "invalid" };

  const slot = await prisma.timetableSlot.findUnique({ where: { id: d.id } });
  if (!slot) return { error: "notFound" };

  // Same cell — nothing to do, and no point writing an audit entry for it.
  if (slot.weekday === d.weekday && slot.startMin === d.startMin) return { ok: true };

  const candidate: SlotShape = {
    id: slot.id,
    weekday: d.weekday,
    startMin: d.startMin,
    endMin: d.endMin,
    classId: slot.classId,
    teacherId: slot.teacherId,
    roomId: slot.roomId,
  };

  const existing = await getYearSlotsForConflict();
  const conflicts = detectConflicts(candidate, existing);
  if (conflicts.length) {
    return { error: "conflict", conflicts: [...new Set(conflicts.map((c) => c.kind))] };
  }

  const moved = await prisma.timetableSlot.update({
    where: { id: slot.id },
    data: { weekday: d.weekday, startMin: d.startMin, endMin: d.endMin },
  });

  await audit({
    actorId: actor.id,
    action: "SLOT_MOVE",
    entity: "TimetableSlot",
    entityId: moved.id,
    before: { weekday: slot.weekday, startMin: slot.startMin, endMin: slot.endMin },
    after: { weekday: moved.weekday, startMin: moved.startMin, endMin: moved.endMin },
  });

  revalidatePath(REVALIDATE, "page");
  return { ok: true };
}
