import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { currentYear } from "@/lib/data/structure";


/**
 * Read models for the timetable. Everything is scoped to the active school year
 * so last year's grid never leaks into this year's.
 */

const slotInclude = {
  subject: true,
  teacher: { include: { user: true } },
  room: true,
} as const;

/** One class's weekly grid. */
export const getClassSlots = cache(
  async (classId: string) => {
    const year = await currentYear();
    if (!year) return [];
    return prisma.timetableSlot.findMany({
      where: { classId, schoolYearId: year.id },
      include: slotInclude,
      orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    });
  },
);

/** One teacher's weekly grid, across every class they teach. */
export const getTeacherSlots = cache(
  async (teacherId: string) => {
    const year = await currentYear();
    if (!year) return [];
    return prisma.timetableSlot.findMany({
      where: { teacherId, schoolYearId: year.id },
      include: { ...slotInclude, class: true },
      orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    });
  },
);

/**
 * Every slot in the year, as the bare shape the conflict engine
 * needs. This is what a write checks itself against — a teacher or room booked
 * by ANOTHER class is exactly the clash we must catch, so the query is not
 * scoped to one class.
 */
export const getYearSlotsForConflict = cache(
  async () => {
    const year = await currentYear();
    if (!year) return [];
    return prisma.timetableSlot.findMany({
      where: { schoolYearId: year.id },
      select: {
        id: true,
        weekday: true,
        startMin: true,
        endMin: true,
        classId: true,
        teacherId: true,
        roomId: true,
      },
    });
  },
);

/**
 * The subject+teacher pairs that may legitimately appear on a class's
 * timetable: the teacher who owns each (class, subject) for the year. The
 * builder offers only these, so a lesson can never name a teacher who doesn't
 * actually teach that subject to that class.
 */
export const classTeachingOptions = cache(async (classId: string) => {
  const year = await currentYear();
  if (!year) return [];
  const assignments = await prisma.teacherAssignment.findMany({
    where: { classId, schoolYearId: year.id },
    include: {
      subject: true,
      teacher: { include: { user: true } },
    },
    orderBy: { subject: { code: "asc" } },
  });
  return assignments.map((a) => ({
    subjectId: a.subjectId,
    subject: a.subject,
    teacherId: a.teacherId,
    teacher: a.teacher,
  }));
});

/** Classes for the active year, lightweight, for the class picker. */
export const listClassesLite = cache(async () => {
  const year = await currentYear();
  if (!year) return [];
  return prisma.class.findMany({
    where: { schoolYearId: year.id },
    select: { id: true, name: true, levelId: true },
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
  });
});

// ---------------------------------------------------------------- identities

/** The teacher profile behind a user, or null. */
export const teacherProfileOf = cache(async (userId: string) =>
  prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true },
  }),
);

/** The class a student is actively enrolled in, or null. */
export const activeClassOfStudent = cache(async (userId: string) => {
  const student = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      enrollments: {
        where: { isActive: true },
        select: { class: { select: { id: true, name: true } } },
        take: 1,
      },
    },
  });
  return student?.enrollments[0]?.class ?? null;
});

/** The active class of one student the caller has already been authorized for. */
export const activeClassOfStudentId = cache(async (studentId: string) => {
  const enr = await prisma.enrollment.findFirst({
    where: { studentId, isActive: true },
    select: { class: { select: { id: true, name: true } } },
  });
  return enr?.class ?? null;
});
