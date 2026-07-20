import "server-only";

import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notifications";
import { formatMAD } from "@/lib/fees";
import { needsSending, overdueCutoff, startOfDay, upcomingWindow } from "@/lib/schedule";

/**
 * Scheduled work, driven by system cron via scripts/jobs.ts.
 *
 * Two rules hold for everything in here:
 *
 * 1. **Idempotent.** Cron retries, an admin re-runs a job by hand, a crash
 *    leaves a half-finished run. Every send is gated on whether an equivalent
 *    notification already went out in the current window, so running a job
 *    five times chases a parent once.
 * 2. **Partial failure is reported, not swallowed.** One parent with a dead
 *    mailbox must not stop the other 199 reminders, but the run must still
 *    tell cron that something went wrong.
 */

export type JobResult = {
  job: string;
  processed: number;
  notified: number;
  errors: string[];
};

/** Guardian user ids for a student, skipping guardians with no login. */
async function guardianUserIds(studentIds: string[]): Promise<Map<string, string[]>> {
  const links = await prisma.studentGuardian.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true, guardian: { select: { userId: true } } },
  });
  const byStudent = new Map<string, string[]>();
  for (const link of links) {
    if (!link.guardian.userId) continue;
    const list = byStudent.get(link.studentId) ?? [];
    list.push(link.guardian.userId);
    byStudent.set(link.studentId, list);
  }
  return byStudent;
}

/**
 * When did this user last get a notification of this type?
 *
 * This is the idempotency key. It deliberately looks at the real Notification
 * table rather than a separate "job ran" marker, so a reminder sent by a human
 * from the fees screen also suppresses the automatic one.
 */
async function lastSentByUser(type: string, userIds: string[]): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.notification.groupBy({
    by: ["userId"],
    where: { type, userId: { in: userIds } },
    _max: { createdAt: true },
  });
  const map = new Map<string, Date>();
  for (const row of rows) {
    if (row._max.createdAt) map.set(row.userId, row._max.createdAt);
  }
  return map;
}

async function settings() {
  const s = await prisma.schoolSettings.findFirst();
  return {
    daysBefore: s?.paymentReminderDaysBefore ?? 5,
    daysAfter: s?.paymentReminderDaysAfter ?? 3,
    absenceThreshold: s?.absenceAlertThreshold ?? 5,
  };
}

/**
 * Flips installments that are past their due date and not fully paid to
 * OVERDUE. Pure bookkeeping — sends nothing.
 */
export async function markOverdueInstallments(now = new Date()): Promise<JobResult> {
  const result = await prisma.installment.updateMany({
    where: {
      dueDate: { lt: startOfDay(now) },
      status: { in: ["PENDING", "PARTIAL"] },
    },
    data: { status: "OVERDUE" },
  });
  return { job: "overdue", processed: result.count, notified: 0, errors: [] };
}

/**
 * Reminds guardians about an installment falling due shortly, and chases the
 * ones already late. One message per guardian per day at most, however many
 * children or installments are involved.
 */
export async function sendPaymentReminders(now = new Date()): Promise<JobResult> {
  const { daysBefore, daysAfter } = await settings();
  const upcoming = upcomingWindow(now, daysBefore);
  const cutoff = overdueCutoff(now, daysAfter);
  const errors: string[] = [];

  const due = await prisma.installment.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      OR: [
        { dueDate: { gte: upcoming.from, lte: upcoming.to } },
        { dueDate: { lte: cutoff } },
      ],
    },
    select: {
      id: true,
      amount: true,
      amountPaid: true,
      dueDate: true,
      feeSchedule: { select: { studentId: true } },
    },
  });
  if (due.length === 0) {
    return { job: "payment-reminders", processed: 0, notified: 0, errors };
  }

  const studentIds = [...new Set(due.map((i) => i.feeSchedule.studentId))];
  const guardians = await guardianUserIds(studentIds);

  // Aggregate per guardian: one message covering everything they owe, rather
  // than one per installment per child.
  const owed = new Map<string, { count: number; total: number; late: boolean }>();
  for (const inst of due) {
    // Prisma returns Decimal; the money engine works in plain numbers.
    const outstanding = Number(inst.amount) - Number(inst.amountPaid);
    if (outstanding <= 0) continue;
    for (const userId of guardians.get(inst.feeSchedule.studentId) ?? []) {
      const entry = owed.get(userId) ?? { count: 0, total: 0, late: false };
      entry.count += 1;
      entry.total += outstanding;
      if (inst.dueDate <= cutoff) entry.late = true;
      owed.set(userId, entry);
    }
  }

  const windowStart = startOfDay(now);
  const lastSent = await lastSentByUser("PAYMENT_DUE", [...owed.keys()]);
  let notified = 0;

  for (const [userId, entry] of owed) {
    if (!needsSending(lastSent.get(userId), windowStart)) continue;
    try {
      await notifyMany([userId], {
        type: "PAYMENT_DUE",
        titleAr: entry.late ? "قسط متأخر" : "تذكير بالأداء",
        titleFr: entry.late ? "Échéance en retard" : "Rappel de paiement",
        bodyAr: entry.late
          ? `لديكم ${entry.count} قسط متأخر بمجموع ${formatMAD(entry.total, "ar")}.`
          : `لديكم ${entry.count} قسط قريب الاستحقاق بمجموع ${formatMAD(entry.total, "ar")}.`,
        bodyFr: entry.late
          ? `${entry.count} échéance(s) en retard, soit ${formatMAD(entry.total, "fr")}.`
          : `${entry.count} échéance(s) à venir, soit ${formatMAD(entry.total, "fr")}.`,
        link: "/parent/fees",
        channels: ["IN_APP", "EMAIL"],
      });
      notified++;
    } catch (e) {
      errors.push(`payment reminder to ${userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { job: "payment-reminders", processed: owed.size, notified, errors };
}

/**
 * Safety net for absence alerts.
 *
 * The attendance action already alerts on the save that crosses the threshold.
 * This catches the cases that never went through that path — a bulk import, a
 * justification being revoked, an alert that failed to send — by looking at
 * the standing count rather than the transition. Scoped to the current
 * semester, and suppressed if this guardian was already alerted within it.
 */
export async function sendAbsenceAlerts(now = new Date()): Promise<JobResult> {
  const { absenceThreshold } = await settings();
  const errors: string[] = [];

  const semester = await prisma.semester.findFirst({
    where: { startDate: { lte: now }, endDate: { gte: now } },
    select: { id: true, startDate: true },
  });
  if (!semester) {
    return { job: "absence-alerts", processed: 0, notified: 0, errors };
  }

  // Unexcused absences only — a justified absence must never trigger a chase.
  const counts = await prisma.attendanceRecord.groupBy({
    by: ["studentId"],
    where: {
      status: "ABSENT",
      isExcused: false,
      session: { date: { gte: semester.startDate, lte: now } },
    },
    _count: { _all: true },
  });
  const over = counts.filter((c) => c._count._all >= absenceThreshold);
  if (over.length === 0) {
    return { job: "absence-alerts", processed: 0, notified: 0, errors };
  }

  const students = await prisma.studentProfile.findMany({
    where: { id: { in: over.map((c) => c.studentId) } },
    select: {
      id: true,
      user: {
        select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true },
      },
    },
  });
  const nameById = new Map(students.map((s) => [s.id, s.user]));
  const guardians = await guardianUserIds(over.map((c) => c.studentId));
  const allGuardians = [...new Set([...guardians.values()].flat())];
  const lastSent = await lastSentByUser("ABSENCE_ALERT", allGuardians);

  let notified = 0;
  for (const row of over) {
    const name = nameById.get(row.studentId);
    const recipients = (guardians.get(row.studentId) ?? []).filter((userId) =>
      // One alert per guardian per semester, whatever the job's cadence.
      needsSending(lastSent.get(userId), semester.startDate),
    );
    if (recipients.length === 0 || !name) continue;

    try {
      await notifyMany(recipients, {
        type: "ABSENCE_ALERT",
        titleAr: "تنبيه غياب",
        titleFr: "Alerte d'absence",
        bodyAr: `بلغ عدد الغيابات غير المبرَّرة لـ ${name.firstNameAr} ${name.lastNameAr} ${row._count._all}.`,
        bodyFr: `${name.firstNameFr} ${name.lastNameFr} totalise ${row._count._all} absences non justifiées.`,
        link: "/parent/attendance",
        channels: ["IN_APP", "EMAIL"],
      });
      // Mark locally too, so two children of the same parent in one run don't
      // both send — the DB read happened before this loop.
      for (const userId of recipients) lastSent.set(userId, new Date());
      notified += recipients.length;
    } catch (e) {
      errors.push(
        `absence alert for ${row.studentId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return { job: "absence-alerts", processed: over.length, notified, errors };
}

/** Everything that should run once a day, in dependency order. */
export async function runDaily(now = new Date()): Promise<JobResult[]> {
  // Overdue marking first: the reminder wording depends on the status it sets.
  const overdue = await markOverdueInstallments(now);
  const payments = await sendPaymentReminders(now);
  const absences = await sendAbsenceAlerts(now);
  return [overdue, payments, absences];
}

export const JOBS = {
  overdue: markOverdueInstallments,
  "payment-reminders": sendPaymentReminders,
  "absence-alerts": sendAbsenceAlerts,
} as const;

export type JobName = keyof typeof JOBS;
