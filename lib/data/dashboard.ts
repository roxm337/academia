import "server-only";

import { prisma } from "@/lib/prisma";
import { currentYear } from "@/lib/data/structure";
import { dayContext } from "@/lib/data/attendance";
import { studentSchedule } from "@/lib/data/fees";
import { unreadAnnouncements } from "@/lib/data/announcements";
import { activeClassOfStudent } from "@/lib/data/timetable";
import { formatMAD } from "@/lib/fees";
import type { SessionUser } from "@/lib/dal";

export type Kpi = { key: string; value: string | number };

/** Timetable-slot count for a class today (0 on a holiday). */
async function todaysLessons(classId: string): Promise<number> {
  const year = await currentYear();
  if (!year) return 0;
  const ctx = await dayContext(new Date());
  if (ctx.holiday) return 0;
  return prisma.timetableSlot.count({
    where: { classId, variant: ctx.variant, weekday: ctx.weekday, schoolYearId: year.id },
  });
}

export async function directorKpis(): Promise<Kpi[]> {
  const year = await currentYear();
  const [students, classes, teachers, pending] = await Promise.all([
    prisma.studentProfile.count({ where: { status: "ACTIVE" } }),
    year ? prisma.class.count({ where: { schoolYearId: year.id } }) : 0,
    prisma.teacherProfile.count(),
    prisma.absenceJustification.count({ where: { status: "PENDING" } }),
  ]);
  return [
    { key: "students", value: students },
    { key: "classes", value: classes },
    { key: "teachers", value: teachers },
    { key: "pendingJustifications", value: pending },
  ];
}

export async function surveillantKpis(): Promise<Kpi[]> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const [pending, todayAbsent, incidents] = await Promise.all([
    prisma.absenceJustification.count({ where: { status: "PENDING" } }),
    prisma.attendanceRecord.count({ where: { status: "ABSENT", session: { date: { gte: start, lte: end } } } }),
    prisma.disciplineIncident.count({ where: { occurredAt: { gte: new Date(Date.now() - 30 * 864e5) } } }),
  ]);
  return [
    { key: "pendingJustifications", value: pending },
    { key: "todayAbsences", value: todayAbsent },
    { key: "recentIncidents", value: incidents },
  ];
}

export async function teacherKpis(userId: string): Promise<Kpi[]> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true, assignments: { select: { classId: true } } },
  });
  if (!profile) return [];
  const classIds = [...new Set(profile.assignments.map((a) => a.classId))];

  const year = await currentYear();
  const ctx = await dayContext(new Date());
  const [todayLessons, toReview] = await Promise.all([
    year && !ctx.holiday
      ? prisma.timetableSlot.count({ where: { teacherId: profile.id, variant: ctx.variant, weekday: ctx.weekday, schoolYearId: year.id } })
      : 0,
    prisma.homeworkSubmission.count({ where: { grade: null, homework: { teacherId: profile.id } } }),
  ]);
  return [
    { key: "myClasses", value: classIds.length },
    { key: "todayLessons", value: todayLessons },
    { key: "toReview", value: toReview },
  ];
}

export async function studentKpis(user: SessionUser, locale: string): Promise<Kpi[]> {
  const [me, klass, unread] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    activeClassOfStudent(user.id),
    unreadAnnouncements(user),
  ]);
  const lessons = klass ? await todaysLessons(klass.id) : 0;
  const sched = me ? await studentSchedule(me.id) : null;
  return [
    { key: "todayLessons", value: lessons },
    { key: "unreadAnnouncements", value: unread },
    { key: "balance", value: sched ? formatMAD(sched.summary.balance, locale) : formatMAD(0, locale) },
  ];
}

export async function parentKpis(user: SessionUser, locale: string): Promise<Kpi[]> {
  const [children, unread] = await Promise.all([
    prisma.guardian.findUnique({
      where: { userId: user.id },
      select: { students: { select: { studentId: true } } },
    }),
    unreadAnnouncements(user),
  ]);
  const studentIds = children?.students.map((s) => s.studentId) ?? [];

  let balance = 0;
  for (const id of studentIds) {
    const sched = await studentSchedule(id);
    if (sched) balance += sched.summary.balance;
  }
  return [
    { key: "children", value: studentIds.length },
    { key: "unreadAnnouncements", value: unread },
    { key: "balanceTotal", value: formatMAD(balance, locale) },
  ];
}
