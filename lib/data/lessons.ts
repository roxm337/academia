import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { curriculumKey } from "@/lib/lessons";
import { localized } from "@/lib/school";
import type { CurriculumOption } from "@/components/learning/lesson-modal";

const teacherLessonInclude = {
  subject: true,
  level: true,
  stream: true,
  lessons: {
    orderBy: { order: "asc" as const },
    include: {
      attachments: { include: { file: true } },
      // Two different numbers: a progress row exists from the first time a
      // student opens the lesson, and only some of those are completions.
      // Prisma can't filter the same relation twice inside one _count, so the
      // completions come back as ids and the views as a count.
      _count: { select: { progress: true } },
      progress: { where: { completedAt: { not: null } }, select: { id: true } },
    },
  },
} as const;

/**
 * Curriculum choices where this teacher has a real class+subject assignment,
 * with labels already resolved for the active locale.
 */
export const teacherContentOptions = cache(async (userId: string, locale: string) => {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      assignments: {
        select: {
          subject: true,
          class: { select: { levelId: true, streamId: true, level: true, stream: true } },
        },
      },
    },
  });
  if (!profile) return null;

  const seen = new Set<string>();
  const options: CurriculumOption[] = profile.assignments.flatMap((assignment) => {
    const key = curriculumKey(
      assignment.class.levelId,
      assignment.class.streamId,
      assignment.subject.id,
    );
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        levelId: assignment.class.levelId,
        levelLabel: localized(assignment.class.level, locale),
        streamId: assignment.class.streamId,
        streamLabel: assignment.class.stream
          ? `${assignment.class.stream.code} — ${localized(assignment.class.stream, locale)}`
          : null,
        subjectId: assignment.subject.id,
        subjectLabel: `${assignment.subject.code} — ${localized(assignment.subject, locale)}`,
      },
    ];
  });
  return { teacherId: profile.id, options };
});

export const teacherUnits = cache(async (teacherId: string) =>
  prisma.unit.findMany({
    where: { authorId: teacherId },
    include: teacherLessonInclude,
    orderBy: [{ level: { order: "asc" } }, { subject: { code: "asc" } }, { order: "asc" }],
  }),
);

/**
 * The class a student is currently enrolled in — the only source of the
 * level/stream scope their reads are allowed to cover. Never taken from a
 * query parameter.
 */
async function activeScope(userId: string) {
  const student = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        take: 1,
        select: {
          class: {
            select: {
              levelId: true,
              streamId: true,
              assignments: { select: { subjectId: true } },
            },
          },
        },
      },
    },
  });
  const enrollment = student?.enrollments[0];
  if (!student || !enrollment) return null;

  // Subjects the class is actually taught. A class with no assignments
  // recorded yet falls back to no subject filter — hiding every lesson from a
  // class whose timetable simply hasn't been entered would be worse than
  // showing one subject too many.
  const subjectIds = [...new Set(enrollment.class.assignments.map((a) => a.subjectId))];
  return {
    studentId: student.id,
    klass: enrollment.class,
    subjectIds: subjectIds.length > 0 ? subjectIds : null,
  };
}

/**
 * Prisma `where` for "units this class may see" — the query form of
 * `unitVisibleTo` in lib/lessons.ts, which is where the rule is tested.
 */
function visibleUnitWhere(
  klass: { levelId: string; streamId: string | null },
  subjectIds: string[] | null,
) {
  return {
    levelId: klass.levelId,
    // A unit with no stream is level-wide; otherwise it must match exactly.
    OR: [{ streamId: null }, { streamId: klass.streamId }],
    // null = the class has no assignments recorded, so do not filter at all.
    ...(subjectIds ? { subjectId: { in: subjectIds } } : {}),
  };
}

export const studentLessons = cache(async (userId: string) => {
  const scope = await activeScope(userId);
  if (!scope) return { studentId: null, units: [] };

  const units = await prisma.unit.findMany({
    where: {
      ...visibleUnitWhere(scope.klass, scope.subjectIds),
      lessons: { some: { isPublished: true } },
    },
    include: {
      subject: true,
      level: true,
      stream: true,
      lessons: {
        where: { isPublished: true },
        orderBy: { order: "asc" },
        include: {
          attachments: { include: { file: true } },
          progress: { where: { studentId: scope.studentId } },
        },
      },
    },
    orderBy: [{ subject: { code: "asc" } }, { order: "asc" }],
  });
  return { studentId: scope.studentId, units };
});

export const studentLesson = cache(async (userId: string, lessonId: string) => {
  const scope = await activeScope(userId);
  if (!scope) return null;

  // The ownership predicate is inside the `where`, so a lesson id belonging to
  // another level simply returns null rather than leaking a row.
  return prisma.lesson.findFirst({
    where: {
      id: lessonId,
      isPublished: true,
      unit: visibleUnitWhere(scope.klass, scope.subjectIds),
    },
    include: {
      unit: { include: { subject: true, level: true, stream: true } },
      attachments: { include: { file: true } },
      progress: { where: { studentId: scope.studentId } },
    },
  });
});
