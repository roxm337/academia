"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/structure";
import type { SessionUser } from "@/lib/dal";

/**
 * The gradebook's security rule, from the brief: a teacher may only touch the
 * gradebook of a class+subject they are actually assigned to — never another
 * teacher's. The director may touch any. Checked on every write, since a Server
 * Action is a public POST.
 */
async function canGrade(
  actor: SessionUser,
  classId: string,
  subjectId: string,
): Promise<boolean> {
  if (actor.role === "DIRECTOR") return true;
  if (actor.role !== "TEACHER") return false;
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (!profile) return false;
  const owns = await prisma.teacherAssignment.findFirst({
    where: { teacherId: profile.id, classId, subjectId },
    select: { id: true },
  });
  return Boolean(owns);
}

/** A locked semester is read-only — grades are frozen for bulletins. */
async function semesterLocked(semesterId: string): Promise<boolean> {
  const s = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { isLocked: true },
  });
  return s?.isLocked ?? false;
}

// ---------------------------------------------------------------- grade items

const itemSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  semesterId: z.string().min(1),
  kind: z.enum(["CONTROLE", "ACTIVITE"]),
  index: z.coerce.number().int().min(1).max(20),
  label: z.string().trim().max(80).optional(),
  maxScore: z.coerce.number().min(1).max(100),
  weight: z.coerce.number().min(0.25).max(10),
});

export async function saveGradeItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  if (!(await canGrade(actor, d.classId, d.subjectId))) return { error: "notAllowed" };
  if (await semesterLocked(d.semesterId)) return { error: "semesterLocked" };

  const data = {
    classId: d.classId,
    subjectId: d.subjectId,
    semesterId: d.semesterId,
    kind: d.kind,
    index: d.index,
    label: d.label || null,
    maxScore: d.maxScore,
    weight: d.weight,
  };

  try {
    const item = d.id
      ? await prisma.gradeItem.update({ where: { id: d.id }, data })
      : await prisma.gradeItem.create({
          data: {
            ...data,
            createdById: (
              await prisma.teacherProfile.findUnique({
                where: { userId: actor.id },
                select: { id: true },
              })
            )?.id,
          },
        });
    await audit({
      actorId: actor.id,
      action: d.id ? "GRADE_ITEM_UPDATE" : "GRADE_ITEM_CREATE",
      entity: "GradeItem",
      entityId: item.id,
      after: item,
    });
  } catch {
    // The @@unique(classId, subjectId, semesterId, kind, index) tripped.
    return { error: "duplicateItem" };
  }

  revalidatePath("/[locale]/(dashboard)/teacher/grades", "page");
  return { ok: true };
}

export async function deleteGradeItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  const item = await prisma.gradeItem.findUnique({ where: { id } });
  if (!item) return { error: "notFound" };
  if (!(await canGrade(actor, item.classId, item.subjectId))) return { error: "notAllowed" };
  if (await semesterLocked(item.semesterId)) return { error: "semesterLocked" };

  await prisma.gradeItem.delete({ where: { id } });
  await audit({
    actorId: actor.id,
    action: "GRADE_ITEM_DELETE",
    entity: "GradeItem",
    entityId: id,
    before: item,
  });

  revalidatePath("/[locale]/(dashboard)/teacher/grades", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- scores

/**
 * Enter/update the scores for one grade item. A blank clears the score (back to
 * "not graded"), not a zero. Each score is validated against the item's own
 * maxScore, server-side.
 */
export async function saveGrades(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const gradeItemId = String(formData.get("gradeItemId") ?? "");
  if (!gradeItemId) return { error: "invalid" };

  const item = await prisma.gradeItem.findUnique({ where: { id: gradeItemId } });
  if (!item) return { error: "notFound" };
  if (!(await canGrade(actor, item.classId, item.subjectId))) return { error: "notAllowed" };
  if (await semesterLocked(item.semesterId)) return { error: "semesterLocked" };

  const maxScore = Number(item.maxScore);
  const roster = await prisma.enrollment.findMany({
    where: { classId: item.classId, isActive: true },
    select: { studentId: true },
  });

  const ops: { studentId: string; score: number | null }[] = [];
  for (const { studentId } of roster) {
    const raw = formData.get(`score:${studentId}`);
    if (raw === null) continue;
    const str = String(raw).trim().replace(",", ".");
    if (str === "") {
      ops.push({ studentId, score: null });
      continue;
    }
    const n = Number(str);
    if (Number.isNaN(n) || n < 0 || n > maxScore) return { error: "badScore" };
    ops.push({ studentId, score: n });
  }

  await prisma.$transaction(
    ops.map((o) =>
      prisma.grade.upsert({
        where: { gradeItemId_studentId: { gradeItemId, studentId: o.studentId } },
        create: { gradeItemId, studentId: o.studentId, score: o.score, enteredById: actor.id },
        update: { score: o.score, enteredById: actor.id },
      }),
    ),
  );

  await audit({
    actorId: actor.id,
    action: "GRADE_ENTER",
    entity: "GradeItem",
    entityId: gradeItemId,
    after: { count: ops.length },
  });

  revalidatePath("/[locale]/(dashboard)/teacher/grades", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- appreciation

const apprSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  semesterId: z.string().min(1),
  text: z.string().trim().max(500),
});

export async function saveAppreciation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = apprSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  if (!(await canGrade(actor, d.classId, d.subjectId))) return { error: "notAllowed" };
  if (await semesterLocked(d.semesterId)) return { error: "semesterLocked" };

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });
  // A director may not own a teacher profile; appreciations are the teacher's
  // voice, so we need one. If the director wants to write, they use the class's
  // main teacher — out of scope here, so require a teacher profile.
  if (!profile) return { error: "notAllowed" };

  if (d.text === "") {
    await prisma.subjectAppreciation.deleteMany({
      where: { studentId: d.studentId, subjectId: d.subjectId, semesterId: d.semesterId },
    });
  } else {
    await prisma.subjectAppreciation.upsert({
      where: {
        studentId_subjectId_semesterId: {
          studentId: d.studentId, subjectId: d.subjectId, semesterId: d.semesterId,
        },
      },
      create: {
        studentId: d.studentId, subjectId: d.subjectId, classId: d.classId,
        semesterId: d.semesterId, teacherId: profile.id, text: d.text,
      },
      update: { text: d.text, teacherId: profile.id },
    });
  }

  revalidatePath("/[locale]/(dashboard)/teacher/grades", "page");
  return { ok: true };
}
