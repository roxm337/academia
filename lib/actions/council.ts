"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { isCouncilDecision } from "@/lib/council";
import { snapshotClass } from "@/lib/council-archive";
import type { ActionState } from "@/lib/actions/structure";

const COUNCIL_PATH = "/[locale]/(dashboard)/director/council";

const entrySchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
  semesterId: z.string().min(1),
  decision: z.string().optional(),
  directorAppreciation: z.string().trim().max(500).optional(),
});

const classSchema = z.object({
  classId: z.string().min(1),
  semesterId: z.string().min(1),
});

/** Guard shared by every council write: nothing may change a finalised row. */
async function assertNotFinal(studentId: string, semesterId: string) {
  const existing = await prisma.semesterResult.findUnique({
    where: { studentId_semesterId: { studentId, semesterId } },
    select: { isFinal: true },
  });
  return !existing?.isFinal;
}

/** Prepare (or refresh) the council's working figures for a class. */
export async function refreshCouncil(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = classSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { classId, semesterId } = parsed.data;

  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { isLocked: true },
  });
  if (!semester) return { error: "notFound" };
  // A locked semester is closed: its archive must not be recomputed.
  if (semester.isLocked) return { error: "semesterLocked" };

  const count = await snapshotClass(classId, semesterId);
  await audit({
    actorId: actor.id,
    action: "COUNCIL_REFRESH",
    entity: "Class",
    entityId: classId,
    after: { semesterId, students: count },
  });

  revalidatePath(COUNCIL_PATH, "page");
  return { ok: true };
}

/** Record the council's decision and the director's comment for one student. */
export async function saveCouncilEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { studentId, classId, semesterId } = parsed.data;

  // Free text would end up printed on a bulletin in whichever language it was
  // typed; a key renders in the reader's language instead.
  const decision = parsed.data.decision?.trim() ?? "";
  if (decision && !isCouncilDecision(decision)) return { error: "invalid" };

  if (!(await assertNotFinal(studentId, semesterId))) return { error: "semesterLocked" };

  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId, classId, isActive: true },
    select: { id: true },
  });
  if (!enrolled) return { error: "notFound" };

  const before = await prisma.semesterResult.findUnique({
    where: { studentId_semesterId: { studentId, semesterId } },
    select: { councilDecision: true, directorAppreciation: true },
  });

  const words = {
    councilDecision: decision || null,
    directorAppreciation: parsed.data.directorAppreciation?.trim() || null,
  };

  await prisma.semesterResult.upsert({
    where: { studentId_semesterId: { studentId, semesterId } },
    update: words,
    // If the council was never refreshed, the row still has to exist to hold
    // the decision; its figures are filled in by the next refresh or the lock.
    create: { studentId, semesterId, classId, ...words },
  });

  await audit({
    actorId: actor.id,
    action: "COUNCIL_DECISION",
    entity: "SemesterResult",
    entityId: studentId,
    before,
    after: words,
  });

  revalidatePath(COUNCIL_PATH, "page");
  return { ok: true };
}
