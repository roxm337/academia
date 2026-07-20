// No SMTP host: the jobs' e-mail leg stays PENDING and nothing leaves the
// machine. Actual delivery is covered by scripts/acceptance-email.mts.
process.env.SMTP_HOST = "";

import "dotenv/config";

import { prisma } from "../lib/prisma";
import { markOverdueInstallments, sendAbsenceAlerts, sendPaymentReminders } from "../lib/jobs";
import { addDays, startOfDay } from "../lib/schedule";

/**
 * Acceptance for the scheduled jobs.
 *
 * The seeded database happens to sit outside every semester and has all its
 * installments already OVERDUE, so a plain run reports zeros. This builds the
 * conditions each job is meant to react to, then asserts both that it acts and
 * that running it a second time does NOT act again — a cron job that chases the
 * same parent every hour is worse than one that never runs.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-jobs.mts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};

const now = new Date();
const cleanup: Array<() => Promise<unknown>> = [];

async function main() {
  const settings = await prisma.schoolSettings.findFirst();
  const threshold = settings?.absenceAlertThreshold ?? 5;

  // ---------------------------------------------------------------- overdue
  console.log("\n== overdue marking ==");
  const schedule = await prisma.feeSchedule.findFirst({ select: { id: true, studentId: true } });
  const feeItem = await prisma.feeItem.findFirst({ select: { id: true } });
  if (!schedule || !feeItem) throw new Error("seed missing: fee schedule / item");

  const late = await prisma.installment.create({
    data: {
      feeScheduleId: schedule.id,
      feeItemId: feeItem.id,
      label: "Acceptance — échéance passée",
      dueDate: addDays(startOfDay(now), -10),
      amount: 500,
      amountPaid: 0,
      status: "PENDING",
    },
  });
  cleanup.push(() => prisma.installment.deleteMany({ where: { id: late.id } }));

  const overdue1 = await markOverdueInstallments(now);
  const afterFlip = await prisma.installment.findUnique({ where: { id: late.id } });
  check("a past-due PENDING installment becomes OVERDUE", afterFlip?.status === "OVERDUE");
  check("the run reports what it changed", overdue1.processed >= 1, `processed=${overdue1.processed}`);

  const overdue2 = await markOverdueInstallments(now);
  check("re-running flips nothing more", overdue2.processed === 0, `processed=${overdue2.processed}`);

  // A paid installment must never be dragged into OVERDUE.
  const paid = await prisma.installment.create({
    data: {
      feeScheduleId: schedule.id,
      feeItemId: feeItem.id,
      label: "Acceptance — déjà payée",
      dueDate: addDays(startOfDay(now), -10),
      amount: 500,
      amountPaid: 500,
      status: "PAID",
    },
  });
  cleanup.push(() => prisma.installment.deleteMany({ where: { id: paid.id } }));
  await markOverdueInstallments(now);
  const stillPaid = await prisma.installment.findUnique({ where: { id: paid.id } });
  check("a PAID installment is left alone", stillPaid?.status === "PAID");

  // ------------------------------------------------------- payment reminders
  console.log("\n== payment reminders ==");
  const guardians = await prisma.studentGuardian.findMany({
    where: { studentId: schedule.studentId },
    select: { guardian: { select: { userId: true } } },
  });
  const guardianIds = guardians.map((g) => g.guardian.userId).filter((x): x is string => Boolean(x));
  check("the test student has a guardian with a login", guardianIds.length > 0);

  // Clear today's reminders so the window starts empty.
  await prisma.notification.deleteMany({
    where: { type: "PAYMENT_DUE", userId: { in: guardianIds }, createdAt: { gte: startOfDay(now) } },
  });

  const pay1 = await sendPaymentReminders(now);
  check("guardians with money outstanding are reminded", pay1.notified > 0, `notified=${pay1.notified}`);
  check("no errors", pay1.errors.length === 0, pay1.errors.join("; "));

  // The guardian's student has several outstanding installments, so this is
  // the aggregation check: one message covering them all, not one each.
  const outstanding = await prisma.installment.count({
    where: {
      feeScheduleId: schedule.id,
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
    },
  });
  const sentToday = await prisma.notification.findMany({
    where: { type: "PAYMENT_DUE", userId: guardianIds[0], createdAt: { gte: startOfDay(now) } },
    select: { channel: true },
  });
  const inAppToday = sentToday.filter((n) => n.channel === "IN_APP").length;
  check(
    "one reminder per guardian, not one per installment",
    inAppToday === 1,
    `${inAppToday} in-app rows for ${outstanding} outstanding installments`,
  );
  // One row per channel is by design — that is how a delivery failure on one
  // channel stays visible without hiding the other.
  check(
    "one row per channel (in-app + e-mail)",
    sentToday.length === 2 && new Set(sentToday.map((n) => n.channel)).size === 2,
    `channels=${sentToday.map((n) => n.channel).join(",")}`,
  );

  const pay2 = await sendPaymentReminders(now);
  check("a second run the same day sends nothing", pay2.notified === 0, `notified=${pay2.notified}`);
  check("but it still sees the same debtors", pay2.processed === pay1.processed);

  // ---------------------------------------------------------- absence alerts
  console.log("\n== absence alerts ==");
  const student = await prisma.studentProfile.findFirst({
    where: { guardians: { some: { guardian: { userId: { not: null } } } } },
    select: {
      id: true,
      guardians: { select: { guardian: { select: { userId: true } } } },
      enrollments: { where: { isActive: true }, take: 1, select: { classId: true } },
    },
  });
  const classId = student?.enrollments[0]?.classId;
  if (!student || !classId) throw new Error("seed missing: enrolled student with a guardian");
  const studentGuardians = student.guardians
    .map((g) => g.guardian.userId)
    .filter((x): x is string => Boolean(x));

  // The seeded year has no semester covering today, so make one.
  const year = await prisma.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
  if (!year) throw new Error("seed missing: active school year");
  const semester = await prisma.semester.create({
    data: {
      schoolYearId: year.id,
      index: 9,
      startDate: addDays(startOfDay(now), -30),
      endDate: addDays(startOfDay(now), 30),
    },
  });
  cleanup.push(() => prisma.semester.deleteMany({ where: { id: semester.id } }));

  // A session needs a real teacher/subject pairing for this class.
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { classId },
    select: { subjectId: true, teacherId: true },
  });
  if (!assignment) throw new Error("seed missing: teacher assignment for the class");
  const marker = await prisma.user.findFirst({ where: { role: "SURVEILLANT" }, select: { id: true } });
  if (!marker) throw new Error("seed missing: surveillant");
  const sessions: string[] = [];
  for (let i = 1; i <= threshold; i++) {
    const session = await prisma.session.create({
      data: {
        classId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        date: addDays(startOfDay(now), -i),
        startMin: 1200,
        endMin: 1260,
      },
    });
    sessions.push(session.id);
    await prisma.attendanceRecord.create({
      data: {
        sessionId: session.id,
        studentId: student.id,
        status: "ABSENT",
        isExcused: false,
        markedById: marker.id,
      },
    });
  }
  cleanup.push(() => prisma.attendanceRecord.deleteMany({ where: { sessionId: { in: sessions } } }));
  cleanup.push(() => prisma.session.deleteMany({ where: { id: { in: sessions } } }));

  await prisma.notification.deleteMany({
    where: {
      type: "ABSENCE_ALERT",
      userId: { in: studentGuardians },
      createdAt: { gte: semester.startDate },
    },
  });

  const abs1 = await sendAbsenceAlerts(now);
  check(
    `a student at ${threshold} unexcused absences triggers an alert`,
    abs1.notified > 0,
    `notified=${abs1.notified} processed=${abs1.processed}`,
  );

  const abs2 = await sendAbsenceAlerts(now);
  check("the same guardian is not alerted twice in one semester", abs2.notified === 0, `notified=${abs2.notified}`);

  // An excused absence must not count toward the threshold.
  await prisma.attendanceRecord.updateMany({
    where: { sessionId: { in: sessions }, studentId: student.id },
    data: { isExcused: true },
  });
  await prisma.notification.deleteMany({
    where: {
      type: "ABSENCE_ALERT",
      userId: { in: studentGuardians },
      createdAt: { gte: semester.startDate },
    },
  });
  const abs3 = await sendAbsenceAlerts(now);
  const alertedAgain = await prisma.notification.count({
    where: {
      type: "ABSENCE_ALERT",
      userId: { in: studentGuardians },
      createdAt: { gte: semester.startDate },
    },
  });
  check(
    "justified absences do not trigger an alert",
    alertedAgain === 0,
    `notified=${abs3.notified}`,
  );

  console.log("\n== cleanup ==");
  for (const undo of cleanup.reverse()) await undo();
  await prisma.notification.deleteMany({
    where: {
      type: { in: ["PAYMENT_DUE", "ABSENCE_ALERT"] },
      createdAt: { gte: startOfDay(now) },
      userId: { in: [...guardianIds, ...studentGuardians] },
    },
  });
  console.log("  ok   test data removed");

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
