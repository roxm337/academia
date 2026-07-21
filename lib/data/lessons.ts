import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { curriculumKey } from "@/lib/lessons";
import { localized } from "@/lib/school";
import type { CurriculumOption } from "@/components/learning/lesson-modal";

const teacherLessonInclude = {
  subject: true,
  level: true,
  speciality: true,
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
        select: { subjectId: true, class: { select: { levelId: true } } },
      },
    },
  });
  if (!profile) return null;

  // The assignments say which (level, subject) pairs this teacher is entitled
  // to; LevelSubject says how each pair is actually taught there — once for the
  // tronc commun, or once per spécialité. Reading the coordinates off the
  // curriculum table is what keeps the picker from offering a spécialité that
  // does not exist at that level.
  const pairs = profile.assignments.map((a) => ({
    levelId: a.class.levelId,
    subjectId: a.subjectId,
  }));
  if (pairs.length === 0) return { teacherId: profile.id, options: [] };

  const rows = await prisma.levelSubject.findMany({
    where: { OR: pairs },
    include: { level: true, speciality: true, subject: true },
  });

  const seen = new Set<string>();
  const options: CurriculumOption[] = rows.flatMap((row) => {
    const key = curriculumKey(row.levelId, row.specialityId, row.subjectId);
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        levelId: row.levelId,
        levelLabel: localized(row.level, locale),
        specialityId: row.specialityId,
        specialityLabel: row.speciality
          ? `${row.speciality.code} — ${localized(row.speciality, locale)}`
          : null,
        subjectId: row.subjectId,
        subjectLabel: `${row.subject.code} — ${localized(row.subject, locale)}`,
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
 * The scope a student's reads are allowed to cover: the level of the class
 * they are enrolled in, plus the spécialités they personally chose. Never
 * taken from a query parameter.
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
              assignments: { select: { subjectId: true } },
            },
          },
        },
      },
      specialities: { select: { specialityId: true } },
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
    learner: {
      levelId: enrollment.class.levelId,
      specialityIds: student.specialities.map((x) => x.specialityId),
    },
    subjectIds: subjectIds.length > 0 ? subjectIds : null,
  };
}

/**
 * Prisma `where` for "units this class may see" — the query form of
 * `unitVisibleTo` in lib/lessons.ts, which is where the rule is tested.
 */
function visibleUnitWhere(
  learner: { levelId: string; specialityIds: string[] },
  subjectIds: string[] | null,
) {
  return {
    levelId: learner.levelId,
    // Tronc commun, or a spécialité this student actually chose.
    OR: [{ specialityId: null }, { specialityId: { in: learner.specialityIds } }],
    // null = the class has no assignments recorded, so do not filter at all.
    ...(subjectIds ? { subjectId: { in: subjectIds } } : {}),
  };
}

export const studentLessons = cache(async (userId: string) => {
  const scope = await activeScope(userId);
  if (!scope) return { studentId: null, units: [] };

  const units = await prisma.unit.findMany({
    where: {
      ...visibleUnitWhere(scope.learner, scope.subjectIds),
      lessons: { some: { isPublished: true } },
    },
    include: {
      subject: true,
      level: true,
      speciality: true,
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
      unit: visibleUnitWhere(scope.learner, scope.subjectIds),
    },
    include: {
      unit: { include: { subject: true, level: true, speciality: true } },
      attachments: { include: { file: true } },
      progress: { where: { studentId: scope.studentId } },
    },
  });
});
