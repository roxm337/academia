import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { currentYear } from "@/lib/data/structure";
import { variantForDate, type TimetableVariant, type Weekday } from "@/lib/timetable";
import { weekdayOf, isHoliday, dayNumber } from "@/lib/attendance";

/** Normalize any Date to that calendar day at UTC midnight (how sessions store `date`). */
export function dayStart(date: Date): Date {
  return new Date(dayNumber(date));
}

/** Parse a YYYY-MM-DD string to a UTC-midnight Date, or null. */
export function parseDay(s: string | undefined | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DayContext = {
  weekday: Weekday;
  variant: TimetableVariant;
  holiday: { nameAr: string; nameFr: string } | null;
};

/** What kind of day this is: weekday, which timetable variant, whether a holiday. */
export const dayContext = cache(async (date: Date): Promise<DayContext> => {
  const year = await currentYear();
  const holidays = year
    ? await prisma.holiday.findMany({
        where: { schoolYearId: year.id },
        select: { nameAr: true, nameFr: true, startDate: true, endDate: true },
      })
    : [];
  const hit = holidays.find((h) =>
    isHoliday(date, [{ startDate: h.startDate, endDate: h.endDate }]),
  );
  return {
    weekday: weekdayOf(date),
    variant: year
      ? variantForDate(date, year.ramadanStart, year.ramadanEnd)
      : "NORMAL",
    holiday: hit ? { nameAr: hit.nameAr, nameFr: hit.nameFr } : null,
  };
});

const slotInclude = {
  subject: true,
  teacher: { include: { user: true } },
  room: true,
} as const;

/**
 * The lessons a class has on a given date, from its timetable — empty on a
 * holiday. Each carries the concrete Session id + how many students are already
 * marked, so the list can show progress without materializing anything.
 */
export const classDaySlots = cache(async (classId: string, date: Date) => {
  const ctx = await dayContext(date);
  if (ctx.holiday) return { ctx, lessons: [] as DayLesson[] };
  const year = await currentYear();
  if (!year) return { ctx, lessons: [] as DayLesson[] };

  const slots = await prisma.timetableSlot.findMany({
    where: { classId, variant: ctx.variant, weekday: ctx.weekday, schoolYearId: year.id },
    include: slotInclude,
    orderBy: { startMin: "asc" },
  });

  const lessons: DayLesson[] = await Promise.all(
    slots.map(async (s) => ({
      ...(await sessionMeta(classId, date, s.startMin)),
      slotId: s.id,
      classId,
      startMin: s.startMin,
      endMin: s.endMin,
      subject: s.subject,
      teacher: s.teacher,
      room: s.room,
    })),
  );
  return { ctx, lessons };
});

/** Same, but every lesson a teacher has that day, across their classes. */
export const teacherDaySlots = cache(async (teacherId: string, date: Date) => {
  const ctx = await dayContext(date);
  if (ctx.holiday) return { ctx, lessons: [] as DayLesson[] };
  const year = await currentYear();
  if (!year) return { ctx, lessons: [] as DayLesson[] };

  const slots = await prisma.timetableSlot.findMany({
    where: { teacherId, variant: ctx.variant, weekday: ctx.weekday, schoolYearId: year.id },
    include: { ...slotInclude, class: true },
    orderBy: { startMin: "asc" },
  });

  const lessons = await Promise.all(
    slots.map(async (s) => ({
      ...(await sessionMeta(s.classId, date, s.startMin)),
      slotId: s.id,
      classId: s.classId,
      className: s.class.name,
      startMin: s.startMin,
      endMin: s.endMin,
      subject: s.subject,
      teacher: s.teacher,
      room: s.room,
    })),
  );
  return { ctx, lessons };
});

export type DayLesson = {
  slotId: string;
  classId: string;
  className?: string;
  startMin: number;
  endMin: number;
  subject: { nameAr: string; nameFr: string };
  teacher: { user: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string } };
  room: { name: string } | null;
  sessionId: string | null;
  markedCount: number;
  rosterCount: number;
};

async function sessionMeta(classId: string, date: Date, startMin: number) {
  const day = dayStart(date);
  const [session, rosterCount] = await Promise.all([
    prisma.session.findUnique({
      where: { classId_date_startMin: { classId, date: day, startMin } },
      select: { id: true, _count: { select: { attendance: true } } },
    }),
    prisma.enrollment.count({ where: { classId, isActive: true } }),
  ]);
  return {
    sessionId: session?.id ?? null,
    markedCount: session?._count.attendance ?? 0,
    rosterCount,
  };
}

/** Active roster for a class — who attendance is taken for. */
export const rosterFor = cache(async (classId: string) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, isActive: true },
    select: {
      student: {
        select: {
          id: true,
          codeMassar: true,
          user: {
            select: {
              firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true,
            },
          },
        },
      },
    },
  });
  return enrollments
    .map((e) => e.student)
    .sort((a, b) => a.user.lastNameFr.localeCompare(b.user.lastNameFr));
});

/** Existing session + its records for one class/date/lesson, or null if not yet marked. */
export const sessionRecords = cache(
  async (classId: string, date: Date, startMin: number) => {
    const day = dayStart(date);
    return prisma.session.findUnique({
      where: { classId_date_startMin: { classId, date: day, startMin } },
      include: { attendance: true },
    });
  },
);

/** One student's attendance over a window, most recent first. */
export const studentAttendance = cache(
  async (studentId: string, fromDate: Date, toDate: Date) =>
    prisma.attendanceRecord.findMany({
      where: {
        studentId,
        session: { date: { gte: dayStart(fromDate), lte: dayStart(toDate) } },
      },
      include: {
        session: { include: { subject: true, class: true } },
        justification: { select: { id: true, status: true } },
      },
      orderBy: [{ session: { date: "desc" } }, { session: { startMin: "asc" } }],
    }),
);

const studentName = {
  select: {
    id: true,
    codeMassar: true,
    user: {
      select: {
        firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true,
      },
    },
  },
} as const;

/** Justifications for the surveillant queue, newest first, optionally by status. */
export const listJustifications = cache(
  async (status?: "PENDING" | "APPROVED" | "REJECTED") =>
    prisma.absenceJustification.findMany({
      where: status ? { status } : undefined,
      include: {
        student: studentName,
        reviewedBy: {
          select: { firstNameFr: true, lastNameFr: true, firstNameAr: true, lastNameAr: true },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
);

/** One student's own justifications (for the parent / student views). */
export const studentJustifications = cache(async (studentId: string) =>
  prisma.absenceJustification.findMany({
    where: { studentId },
    orderBy: { submittedAt: "desc" },
  }),
);

/** Discipline incidents for the surveillant register, newest first. */
export const listIncidents = cache(async () =>
  prisma.disciplineIncident.findMany({
    include: {
      student: studentName,
      class: { select: { name: true } },
      reportedBy: {
        select: { firstNameFr: true, lastNameFr: true, firstNameAr: true, lastNameAr: true },
      },
    },
    orderBy: { occurredAt: "desc" },
  }),
);

/** Incidents concerning one student (parent / student view). */
export const studentIncidents = cache(async (studentId: string) =>
  prisma.disciplineIncident.findMany({
    where: { studentId },
    orderBy: { occurredAt: "desc" },
  }),
);

/** Absence tallies for one student across the whole current year. */
export const absenceSummary = cache(async (studentId: string) => {
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId },
    select: { status: true, isExcused: true },
  });
  return {
    absent: records.filter((r) => r.status === "ABSENT").length,
    unexcused: records.filter((r) => r.status === "ABSENT" && !r.isExcused).length,
    late: records.filter((r) => r.status === "LATE").length,
  };
});
