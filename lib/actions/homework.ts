"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, teacherOwning } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { storeUpload, DOC_TYPES } from "@/lib/storage";
import { isLate } from "@/lib/homework";
import { parseDay } from "@/lib/data/attendance";
import type { ActionState } from "@/lib/actions/structure";

/** A due date is the end of the chosen day. */
function endOfDay(day: Date): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59));
}

// ---------------------------------------------------------------- teacher

const hwSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  instructions: z.string().trim().min(1).max(4000),
  dueDate: z.string().min(1),
  isPublished: z.enum(["on"]).optional(),
});

export async function saveHomework(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = hwSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const teacherId = await teacherOwning(actor.id, d.classId, d.subjectId);
  if (!teacherId) return { error: "notAllowed" };

  const day = parseDay(d.dueDate);
  if (!day) return { error: "invalid" };
  const dueAt = endOfDay(day);
  const isPublished = d.isPublished === "on";

  let homeworkId = d.id;
  if (d.id) {
    const before = await prisma.homework.findUnique({ where: { id: d.id } });
    if (!before || before.teacherId !== teacherId) return { error: "notAllowed" };
    await prisma.homework.update({
      where: { id: d.id },
      data: { title: d.title, instructions: d.instructions, dueAt, isPublished },
    });
  } else {
    const created = await prisma.homework.create({
      data: {
        classId: d.classId, subjectId: d.subjectId, teacherId,
        title: d.title, instructions: d.instructions, dueAt, isPublished,
      },
    });
    homeworkId = created.id;
  }

  const file = formData.get("file");
  if (file instanceof File && file.size > 0 && homeworkId) {
    const up = await storeUpload(file, {
      uploadedById: actor.id,
      folder: `homework/${homeworkId}`,
      allowed: DOC_TYPES,
    });
    if (!up.ok) return { error: up.error };
    await prisma.attachment.create({ data: { fileId: up.fileId, homeworkId } });
  }

  await audit({
    actorId: actor.id,
    action: d.id ? "HOMEWORK_UPDATE" : "HOMEWORK_CREATE",
    entity: "Homework",
    entityId: homeworkId!,
  });

  revalidatePath("/[locale]/(dashboard)/teacher/homework", "page");
  return { ok: true };
}

export async function deleteHomework(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };
  const hw = await prisma.homework.findUnique({ where: { id } });
  if (!hw) return { error: "notFound" };
  if (!(await teacherOwning(actor.id, hw.classId, hw.subjectId))) return { error: "notAllowed" };

  await prisma.homework.delete({ where: { id } });
  await audit({ actorId: actor.id, action: "HOMEWORK_DELETE", entity: "Homework", entityId: id });
  revalidatePath("/[locale]/(dashboard)/teacher/homework", "page");
  return { ok: true };
}

const reviewSchema = z.object({
  submissionId: z.string().min(1),
  teacherComment: z.string().trim().max(1000).optional(),
  grade: z.string().optional(),
});

export async function reviewSubmission(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { submissionId, teacherComment } = parsed.data;

  const submission = await prisma.homeworkSubmission.findUnique({
    where: { id: submissionId },
    include: { homework: { select: { classId: true, subjectId: true } } },
  });
  if (!submission) return { error: "notFound" };
  if (!(await teacherOwning(actor.id, submission.homework.classId, submission.homework.subjectId))) {
    return { error: "notAllowed" };
  }

  let grade: number | null = null;
  if (parsed.data.grade && parsed.data.grade.trim() !== "") {
    const n = Number(parsed.data.grade.replace(",", "."));
    if (Number.isNaN(n) || n < 0 || n > 20) return { error: "badScore" };
    grade = n;
  }

  await prisma.homeworkSubmission.update({
    where: { id: submissionId },
    data: { teacherComment: teacherComment || null, grade, reviewedAt: new Date() },
  });

  await audit({
    actorId: actor.id,
    action: "SUBMISSION_REVIEW",
    entity: "HomeworkSubmission",
    entityId: submissionId,
  });

  revalidatePath("/[locale]/(dashboard)/teacher/homework", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- student

const submitSchema = z.object({
  homeworkId: z.string().min(1),
  studentNote: z.string().trim().max(1000).optional(),
});

/**
 * A student turns in their work. The homework must be published and belong to a
 * class the student is actively enrolled in — both re-checked here, never taken
 * from the form. Lateness is stamped from the server clock, not the client's.
 */
export async function submitHomework(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  if (actor.role !== "STUDENT") return { error: "notAllowed" };

  const parsed = submitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const me = await prisma.studentProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (!me) return { error: "notAllowed" };

  const hw = await prisma.homework.findUnique({
    where: { id: parsed.data.homeworkId },
    select: { id: true, classId: true, dueAt: true, isPublished: true },
  });
  if (!hw || !hw.isPublished) return { error: "notFound" };

  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId: me.id, classId: hw.classId, isActive: true },
    select: { id: true },
  });
  if (!enrolled) return { error: "notAllowed" };

  const now = new Date();
  const submission = await prisma.homeworkSubmission.upsert({
    where: { homeworkId_studentId: { homeworkId: hw.id, studentId: me.id } },
    create: {
      homeworkId: hw.id,
      studentId: me.id,
      studentNote: parsed.data.studentNote || null,
      isLate: isLate(hw.dueAt, now),
      submittedAt: now,
    },
    update: {
      studentNote: parsed.data.studentNote || null,
      isLate: isLate(hw.dueAt, now),
      submittedAt: now,
    },
  });

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const up = await storeUpload(file, {
      uploadedById: actor.id,
      folder: `submissions/${submission.id}`,
      allowed: DOC_TYPES,
    });
    if (!up.ok) return { error: up.error };
    await prisma.attachment.create({ data: { fileId: up.fileId, submissionId: submission.id } });
  }

  // Let the teacher know work came in.
  const teacher = await prisma.homework.findUnique({
    where: { id: hw.id },
    select: { teacher: { select: { userId: true } } },
  });
  if (teacher?.teacher.userId) {
    await notifyMany([teacher.teacher.userId], {
      type: "HOMEWORK_SUBMISSION",
      titleAr: "تسليم واجب",
      titleFr: "Devoir rendu",
      bodyAr: "قام تلميذ بتسليم واجب.",
      bodyFr: "Un élève a rendu un devoir.",
      link: "/teacher/homework",
    });
  }

  await audit({
    actorId: actor.id,
    action: "HOMEWORK_SUBMIT",
    entity: "HomeworkSubmission",
    entityId: submission.id,
  });

  revalidatePath("/[locale]/(dashboard)/student/homework", "page");
  return { ok: true };
}
