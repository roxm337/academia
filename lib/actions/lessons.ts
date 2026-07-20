"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { canAuthorAt, nextOrder, normalizeStream } from "@/lib/lessons";
import { attachFiles } from "@/lib/lesson-attachments";
import type { ActionState } from "@/lib/actions/structure";

const TEACHER_PATH = "/[locale]/(dashboard)/teacher/lessons";
const STUDENT_PATH = "/[locale]/(dashboard)/student/lessons";
const STUDENT_DETAIL_PATH = "/[locale]/(dashboard)/student/lessons/[id]";

/**
 * Curriculum coordinates are only accepted from the form when CREATING, where
 * there is nothing else to go on. Every other path re-derives them from the
 * stored unit, so a stale form can never redirect a write somewhere else.
 */
const createSchema = z.object({
  unitId: z.string().optional(),
  levelId: z.string().min(1),
  streamId: z.string().optional(),
  subjectId: z.string().min(1),
  unitTitleAr: z.string().trim().min(1).max(160),
  unitTitleFr: z.string().trim().min(1).max(160),
  lessonTitleAr: z.string().trim().min(1).max(160),
  lessonTitleFr: z.string().trim().min(1).max(160),
  contentAr: z.string().trim().min(1).max(20000),
  contentFr: z.string().trim().min(1).max(20000),
  isPublished: z.enum(["on"]).optional(),
});

const editSchema = z.object({
  lessonId: z.string().min(1),
  lessonTitleAr: z.string().trim().min(1).max(160),
  lessonTitleFr: z.string().trim().min(1).max(160),
  contentAr: z.string().trim().min(1).max(20000),
  contentFr: z.string().trim().min(1).max(20000),
  isPublished: z.enum(["on"]).optional(),
});

const unitSchema = z.object({
  unitId: z.string().min(1),
  unitTitleAr: z.string().trim().min(1).max(160),
  unitTitleFr: z.string().trim().min(1).max(160),
});

/**
 * The teacher's own profile id, but only if they actually teach the given
 * subject at the given level+stream. Returns null for every other role, since
 * only a TEACHER has a TeacherProfile.
 */
async function authorAt(
  actorId: string,
  levelId: string,
  streamId: string | null | undefined,
  subjectId: string,
) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: actorId },
    select: {
      id: true,
      assignments: {
        where: { subjectId },
        select: { class: { select: { levelId: true, streamId: true } } },
      },
    },
  });
  if (!profile) return null;
  const assignments = profile.assignments.map((a) => a.class);
  return canAuthorAt(assignments, { levelId, streamId }) ? profile.id : null;
}

/** The unit behind a lesson, with the caller's authorship already verified. */
async function ownedLesson(actorId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: true },
  });
  if (!lesson) return { error: "notFound" as const };
  // Derived from the stored unit, never from the form — deleteLesson always
  // did this, and the edit path used to trust the form instead.
  const teacherId = await authorAt(
    actorId,
    lesson.unit.levelId,
    lesson.unit.streamId,
    lesson.unit.subjectId,
  );
  if (!teacherId || lesson.unit.authorId !== teacherId) {
    return { error: "notAllowed" as const };
  }
  return { lesson, teacherId };
}

/** Students who can see a unit, for publication notices. */
async function audienceFor(unit: { levelId: string; streamId: string | null }) {
  const students = await prisma.studentProfile.findMany({
    where: {
      enrollments: {
        some: {
          isActive: true,
          class: {
            levelId: unit.levelId,
            // A level-wide unit (no stream) reaches every stream at the level.
            ...(unit.streamId ? { streamId: unit.streamId } : {}),
          },
        },
      },
    },
    select: { userId: true },
  });
  return students.map((s) => s.userId);
}

async function announcePublication(lessonId: string, unit: { levelId: string; streamId: string | null }) {
  const userIds = await audienceFor(unit);
  if (userIds.length === 0) return;
  await notifyMany(userIds, {
    type: "LESSON_PUBLISHED",
    titleAr: "درس جديد",
    titleFr: "Nouveau cours",
    bodyAr: "تم نشر درس جديد في مقرركم.",
    bodyFr: "Un nouveau cours a été publié pour votre niveau.",
    link: `/student/lessons/${lessonId}`,
  });
}

export async function createLesson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  const streamId = normalizeStream(d.streamId);

  const teacherId = await authorAt(actor.id, d.levelId, streamId, d.subjectId);
  if (!teacherId) return { error: "notAllowed" };
  const published = d.isPublished === "on";

  const unit = d.unitId
    ? await prisma.unit.findFirst({
        where: {
          id: d.unitId,
          authorId: teacherId,
          levelId: d.levelId,
          streamId,
          subjectId: d.subjectId,
        },
      })
    : await prisma.unit.create({
        data: {
          authorId: teacherId,
          levelId: d.levelId,
          streamId,
          subjectId: d.subjectId,
          titleAr: d.unitTitleAr,
          titleFr: d.unitTitleFr,
          // Append after the teacher's existing units at this level.
          order: nextOrder(
            (
              await prisma.unit.aggregate({
                where: { authorId: teacherId, levelId: d.levelId },
                _max: { order: true },
              })
            )._max.order,
          ),
        },
      });
  if (!unit) return { error: "notAllowed" };

  // (unitId, order) is unique, and reading the max then inserting is a race:
  // two lessons submitted at once would both compute the same position and the
  // second insert would throw. Retry on the collision rather than 500.
  let lesson: { id: string } | null = null;
  for (let attempt = 0; attempt < 5 && !lesson; attempt++) {
    try {
      lesson = await prisma.$transaction(async (tx) => {
        const last = await tx.lesson.aggregate({
          where: { unitId: unit.id },
          _max: { order: true },
        });
        return tx.lesson.create({
          data: {
            unitId: unit.id,
            order: nextOrder(last._max.order),
            titleAr: d.lessonTitleAr,
            titleFr: d.lessonTitleFr,
            contentAr: d.contentAr,
            contentFr: d.contentFr,
            isPublished: published,
            publishedAt: published ? new Date() : null,
          },
          select: { id: true },
        });
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  if (!lesson) return { error: "busy" };

  const failed = await attachFiles(formData, lesson.id, actor.id);

  await audit({
    actorId: actor.id,
    action: "LESSON_CREATE",
    entity: "Lesson",
    entityId: lesson.id,
    after: { unitId: unit.id, titleFr: d.lessonTitleFr, isPublished: published },
  });
  if (published) await announcePublication(lesson.id, unit);

  revalidatePath(TEACHER_PATH, "page");
  revalidatePath(STUDENT_PATH, "page");
  // The upload is reported after the lesson is safely saved and audited, so a
  // rejected file never silently loses the lesson the teacher just wrote.
  if (failed) return failed;
  return { ok: true };
}

export async function updateLesson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const owned = await ownedLesson(actor.id, d.lessonId);
  if ("error" in owned) return { error: owned.error };
  const { lesson } = owned;

  const published = d.isPublished === "on";
  const newlyPublished = published && !lesson.isPublished;

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      titleAr: d.lessonTitleAr,
      titleFr: d.lessonTitleFr,
      contentAr: d.contentAr,
      contentFr: d.contentFr,
      isPublished: published,
      publishedAt: published ? (lesson.publishedAt ?? new Date()) : null,
    },
  });

  const failed = await attachFiles(formData, lesson.id, actor.id);

  await audit({
    actorId: actor.id,
    action: "LESSON_UPDATE",
    entity: "Lesson",
    entityId: lesson.id,
    // Publication state is the contestable part — record both sides.
    before: { titleFr: lesson.titleFr, isPublished: lesson.isPublished },
    after: { titleFr: d.lessonTitleFr, isPublished: published },
  });
  if (newlyPublished) await announcePublication(lesson.id, lesson.unit);

  revalidatePath(TEACHER_PATH, "page");
  revalidatePath(STUDENT_PATH, "page");
  revalidatePath(STUDENT_DETAIL_PATH, "page");
  if (failed) return failed;
  return { ok: true };
}

/** Rename a unit. Separate from the lesson form: one unit, one owner of its title. */
export async function updateUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = unitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const unit = await prisma.unit.findUnique({ where: { id: d.unitId } });
  if (!unit) return { error: "notFound" };
  const teacherId = await authorAt(actor.id, unit.levelId, unit.streamId, unit.subjectId);
  if (!teacherId || unit.authorId !== teacherId) return { error: "notAllowed" };

  await prisma.unit.update({
    where: { id: unit.id },
    data: { titleAr: d.unitTitleAr, titleFr: d.unitTitleFr },
  });
  await audit({
    actorId: actor.id,
    action: "UNIT_UPDATE",
    entity: "Unit",
    entityId: unit.id,
    before: { titleFr: unit.titleFr },
    after: { titleFr: d.unitTitleFr },
  });

  revalidatePath(TEACHER_PATH, "page");
  revalidatePath(STUDENT_PATH, "page");
  return { ok: true };
}

export async function deleteUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  const id = String(formData.get("id") ?? "");
  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit) return { error: "notFound" };
  const teacherId = await authorAt(actor.id, unit.levelId, unit.streamId, unit.subjectId);
  if (!teacherId || unit.authorId !== teacherId) return { error: "notAllowed" };

  // Lessons, attachments and progress cascade (schema.prisma onDelete: Cascade).
  await prisma.unit.delete({ where: { id } });
  await audit({
    actorId: actor.id,
    action: "UNIT_DELETE",
    entity: "Unit",
    entityId: id,
    before: { titleFr: unit.titleFr },
  });

  revalidatePath(TEACHER_PATH, "page");
  revalidatePath(STUDENT_PATH, "page");
  return { ok: true };
}

export async function deleteLesson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  const id = String(formData.get("id") ?? "");
  const owned = await ownedLesson(actor.id, id);
  if ("error" in owned) return { error: owned.error };
  const { lesson } = owned;

  await prisma.$transaction(async (tx) => {
    await tx.lesson.delete({ where: { id } });
    // An empty unit is unreachable for students and uneditable for the
    // teacher, so removing the last lesson removes the unit with it.
    const remaining = await tx.lesson.count({ where: { unitId: lesson.unitId } });
    if (remaining === 0) await tx.unit.delete({ where: { id: lesson.unitId } });
  });

  await audit({
    actorId: actor.id,
    action: "LESSON_DELETE",
    entity: "Lesson",
    entityId: id,
    before: { titleFr: lesson.titleFr, unitId: lesson.unitId },
  });

  revalidatePath(TEACHER_PATH, "page");
  revalidatePath(STUDENT_PATH, "page");
  return { ok: true };
}

export async function deleteLessonAttachment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const id = String(formData.get("id") ?? "");
  const attachment = await prisma.lessonAttachment.findUnique({
    where: { id },
    select: { id: true, lessonId: true, fileId: true },
  });
  if (!attachment) return { error: "notFound" };
  const owned = await ownedLesson(actor.id, attachment.lessonId);
  if ("error" in owned) return { error: owned.error };

  await prisma.lessonAttachment.delete({ where: { id } });
  await audit({
    actorId: actor.id,
    action: "LESSON_ATTACHMENT_DELETE",
    entity: "LessonAttachment",
    entityId: id,
    before: { lessonId: attachment.lessonId, fileId: attachment.fileId },
  });

  revalidatePath(TEACHER_PATH, "page");
  revalidatePath(STUDENT_DETAIL_PATH, "page");
  return { ok: true };
}

/** The student's own view of a lesson, verified against their active enrolment. */
async function readableLesson(actorRole: string, actorId: string, lessonId: string) {
  if (actorRole !== "STUDENT") return { error: "notAllowed" as const };
  const student = await prisma.studentProfile.findUnique({
    where: { userId: actorId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        take: 1,
        select: { class: { select: { levelId: true, streamId: true } } },
      },
    },
  });
  const enrollment = student?.enrollments[0];
  if (!student || !enrollment) return { error: "notAllowed" as const };

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      isPublished: true,
      unit: {
        levelId: enrollment.class.levelId,
        OR: [{ streamId: null }, { streamId: enrollment.class.streamId }],
      },
    },
    select: { id: true },
  });
  if (!lesson) return { error: "notFound" as const };
  return { studentId: student.id, lessonId: lesson.id };
}

/**
 * Records that the student opened the lesson. Called from an effect once the
 * page is on screen — a page render must not write to the database.
 */
export async function recordLessonView(lessonId: string): Promise<void> {
  const actor = await verifySession();
  const readable = await readableLesson(actor.role, actor.id, lessonId);
  if ("error" in readable) return;

  await prisma.lessonProgress.upsert({
    where: {
      lessonId_studentId: { lessonId: readable.lessonId, studentId: readable.studentId },
    },
    create: { lessonId: readable.lessonId, studentId: readable.studentId },
    update: { lastViewedAt: new Date() },
  });
}

export async function markLessonComplete(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const lessonId = String(formData.get("lessonId") ?? "");
  const readable = await readableLesson(actor.role, actor.id, lessonId);
  if ("error" in readable) return { error: readable.error };

  // The button toggles: a mis-click has to be undoable.
  const existing = await prisma.lessonProgress.findUnique({
    where: {
      lessonId_studentId: { lessonId: readable.lessonId, studentId: readable.studentId },
    },
    select: { completedAt: true },
  });
  const completedAt = existing?.completedAt ? null : new Date();

  await prisma.lessonProgress.upsert({
    where: {
      lessonId_studentId: { lessonId: readable.lessonId, studentId: readable.studentId },
    },
    create: { lessonId: readable.lessonId, studentId: readable.studentId, completedAt },
    update: { lastViewedAt: new Date(), completedAt },
  });

  await audit({
    actorId: actor.id,
    action: completedAt ? "LESSON_COMPLETE" : "LESSON_UNCOMPLETE",
    entity: "LessonProgress",
    entityId: readable.lessonId,
  });

  revalidatePath(STUDENT_PATH, "page");
  // The pattern, not the concrete id — revalidatePath matches route patterns,
  // so interpolating an id here would silently match nothing.
  revalidatePath(STUDENT_DETAIL_PATH, "page");
  return { ok: true };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
}
