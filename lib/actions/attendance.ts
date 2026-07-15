"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { getSchoolSettings } from "@/lib/school";
import { notifyMany } from "@/lib/notifications";
import { crossesThreshold, type AttendanceStatus } from "@/lib/attendance";
import { dayStart, parseDay } from "@/lib/data/attendance";
import type { ActionState } from "@/lib/actions/structure";

export type AttendanceState =
  | (NonNullable<ActionState> & { alerted?: number })
  | null;

const STATUS = z.enum(["PRESENT", "ABSENT", "LATE"]);
const markSchema = z.object({
  classId: z.string().min(1),
  slotId: z.string().min(1),
  date: z.string().min(1),
});

/**
 * Record attendance for one lesson.
 *
 * Who may mark: a surveillant or the director always; a teacher only when the
 * school allows it AND the lesson is their own (class + subject). The session
 * row is materialized here, on write — never during a page render.
 */
export async function markAttendance(
  _prev: AttendanceState,
  formData: FormData,
): Promise<AttendanceState> {
  const actor = await verifySession();

  const parsed = markSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { classId, slotId } = parsed.data;
  const date = parseDay(parsed.data.date);
  if (!date) return { error: "invalid" };
  const day = dayStart(date);

  const slot = await prisma.timetableSlot.findUnique({
    where: { id: slotId },
    include: { schoolYear: { select: { id: true } } },
  });
  if (!slot || slot.classId !== classId) return { error: "notFound" };

  // --- authorization ------------------------------------------------------
  if (actor.role === "TEACHER") {
    const settings = await getSchoolSettings();
    if (!settings?.teachersCanTakeAttendance) return { error: "notAllowed" };
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    const owns =
      profile &&
      (await prisma.teacherAssignment.findFirst({
        where: {
          teacherId: profile.id,
          classId,
          subjectId: slot.subjectId,
          schoolYearId: slot.schoolYearId,
        },
        select: { id: true },
      }));
    if (!owns) return { error: "notAllowed" };
  } else if (actor.role !== "SURVEILLANT" && actor.role !== "DIRECTOR") {
    return { error: "notAllowed" };
  }

  // --- roster + submitted statuses ---------------------------------------
  const roster = await prisma.enrollment.findMany({
    where: { classId, isActive: true },
    select: { studentId: true },
  });
  const rosterIds = roster.map((r) => r.studentId);

  const statuses = new Map<string, AttendanceStatus>();
  for (const id of rosterIds) {
    const raw = formData.get(`status:${id}`);
    const s = STATUS.safeParse(raw);
    if (s.success) statuses.set(id, s.data);
  }
  if (statuses.size === 0) return { error: "invalid" };

  // Unexcused-absence counts BEFORE this save, per student, to alert on crossing.
  const settings = await getSchoolSettings();
  const threshold = settings?.absenceAlertThreshold ?? 0;
  const before = await unexcusedCounts(rosterIds);

  // --- materialize the session, then upsert every record ------------------
  await prisma.$transaction(async (tx) => {
    const session = await tx.session.upsert({
      where: { classId_date_startMin: { classId, date: day, startMin: slot.startMin } },
      create: {
        slotId: slot.id,
        classId,
        subjectId: slot.subjectId,
        teacherId: slot.teacherId,
        roomId: slot.roomId,
        date: day,
        startMin: slot.startMin,
        endMin: slot.endMin,
      },
      update: {},
    });

    for (const [studentId, status] of statuses) {
      await tx.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId } },
        // Never touch isExcused / justificationId here — that's the
        // justification workflow's business, not a re-mark's.
        create: { sessionId: session.id, studentId, status, markedById: actor.id },
        update: { status, markedById: actor.id, markedAt: new Date() },
      });
    }
  });

  // --- absence alerts (fire once, as the count crosses the threshold) ------
  let alerted = 0;
  if (threshold > 0) {
    const after = await unexcusedCounts(rosterIds);
    for (const studentId of rosterIds) {
      const b = before.get(studentId) ?? 0;
      const a = after.get(studentId) ?? 0;
      if (crossesThreshold(b, a, threshold)) {
        alerted += await alertGuardians(studentId, a);
      }
    }
  }

  await audit({
    actorId: actor.id,
    action: "ATTENDANCE_MARK",
    entity: "Session",
    entityId: `${classId}:${day.toISOString().slice(0, 10)}:${slot.startMin}`,
    after: { marked: statuses.size, alerted },
  });

  revalidatePath("/[locale]/(dashboard)/surveillant/attendance", "page");
  revalidatePath("/[locale]/(dashboard)/teacher/attendance", "page");
  return { ok: true, alerted };
}

/** Unexcused-absence count per student, as a Map. */
async function unexcusedCounts(studentIds: string[]): Promise<Map<string, number>> {
  const rows = await prisma.attendanceRecord.groupBy({
    by: ["studentId"],
    where: { studentId: { in: studentIds }, status: "ABSENT", isExcused: false },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.studentId, r._count._all]));
}

/** Notify every portal-enabled guardian of a student. Returns how many were told. */
async function alertGuardians(studentId: string, count: number): Promise<number> {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      user: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true } },
      guardians: {
        select: { guardian: { select: { userId: true } } },
      },
    },
  });
  if (!student) return 0;
  const guardianUserIds = student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => Boolean(id));
  if (guardianUserIds.length === 0) return 0;

  const nameAr = `${student.user.firstNameAr} ${student.user.lastNameAr}`;
  const nameFr = `${student.user.firstNameFr} ${student.user.lastNameFr}`;
  await notifyMany(guardianUserIds, {
    type: "ABSENCE_ALERT",
    titleAr: "تنبيه غياب",
    titleFr: "Alerte d'absence",
    bodyAr: `بلغ عدد الغيابات غير المبرَّرة لـ ${nameAr} ${count}.`,
    bodyFr: `${nameFr} totalise ${count} absences non justifiées.`,
    link: "/parent/attendance",
  });
  return guardianUserIds.length;
}
