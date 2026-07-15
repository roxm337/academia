"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { currentYear } from "@/lib/data/structure";
import { getYearSlotsForConflict } from "@/lib/data/timetable";
import { detectConflicts, type SlotShape } from "@/lib/timetable";
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
    weekday: z.enum([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ]),
    variant: z.enum(["NORMAL", "RAMADAN"]),
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
    variant: d.variant,
    startMin: d.startMin,
    endMin: d.endMin,
    classId: d.classId,
    teacherId: d.teacherId,
    roomId,
  };

  const existing = await getYearSlotsForConflict(d.variant);
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
    variant: d.variant,
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

/**
 * Seed a class's Ramadan grid from its normal one. The Ramadan periods are
 * shorter, so this copies the *placement* (weekday, subject, teacher, room) and
 * lets the director re-time each lesson — it does not blindly copy 60-minute
 * bands into a 45-minute day.
 *
 * Every copy is conflict-checked against the rest of the Ramadan timetable
 * (a teacher may already be booked elsewhere at that hour); clashes are skipped
 * and counted rather than aborting the whole copy.
 */
const copySchema = z.object({ classId: z.string().min(1) });

export async function copyNormalToRamadan(
  _prev: SlotState,
  formData: FormData,
): Promise<SlotState> {
  const actor = await requireRole("DIRECTOR");
  const year = await currentYear();
  if (!year) return { error: "noSchoolYear" };

  const parsed = copySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { classId } = parsed.data;

  const source = await prisma.timetableSlot.findMany({
    where: { classId, variant: "NORMAL", schoolYearId: year.id },
  });
  if (source.length === 0) return { error: "nothingToCopy" };

  // Replace whatever Ramadan grid this class already had.
  await prisma.timetableSlot.deleteMany({
    where: { classId, variant: "RAMADAN", schoolYearId: year.id },
  });

  const existing = await getYearSlotsForConflict("RAMADAN");
  let copied = 0;
  let skipped = 0;

  for (const s of source) {
    const candidate: SlotShape = {
      weekday: s.weekday,
      variant: "RAMADAN",
      startMin: s.startMin,
      endMin: s.endMin,
      classId: s.classId,
      teacherId: s.teacherId,
      roomId: s.roomId,
    };
    if (detectConflicts(candidate, existing).length) {
      skipped++;
      continue;
    }
    const created = await prisma.timetableSlot.create({
      data: {
        schoolYearId: year.id,
        classId: s.classId,
        subjectId: s.subjectId,
        teacherId: s.teacherId,
        roomId: s.roomId,
        weekday: s.weekday,
        variant: "RAMADAN",
        startMin: s.startMin,
        endMin: s.endMin,
      },
    });
    // Keep the running set current so two copies can't book the same room.
    existing.push({
      id: created.id,
      weekday: s.weekday,
      variant: "RAMADAN",
      startMin: s.startMin,
      endMin: s.endMin,
      classId: s.classId,
      teacherId: s.teacherId,
      roomId: s.roomId,
    });
    copied++;
  }

  await audit({
    actorId: actor.id,
    action: "TIMETABLE_COPY_RAMADAN",
    entity: "Class",
    entityId: classId,
    after: { copied, skipped },
  });

  revalidatePath(REVALIDATE, "page");
  return { ok: true, copied, skipped };
}
