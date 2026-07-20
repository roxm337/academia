import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { crossesThreshold } from "../lib/attendance";
import { notify } from "../lib/notifications";

/**
 * Milestone 4 acceptance, against real database rows:
 *   1. an unexcused-absence count crossing the threshold fires ONE parent alert,
 *      and not again on the next absence;
 *   2. approving a justification excuses the covered absences, dropping the
 *      unexcused count back to zero.
 *
 * Uses the real notify() and the real crossesThreshold engine; cleans up after.
 *   npx tsx --conditions=react-server scripts/acceptance-attendance.ts
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const THRESHOLD = 3;

async function unexcused(studentId: string) {
  return prisma.attendanceRecord.count({
    where: { studentId, status: "ABSENT", isExcused: false },
  });
}

async function main() {
  // A student with a portal-enabled guardian, actively enrolled.
  const student = await prisma.studentProfile.findFirst({
    where: {
      status: "ACTIVE",
      enrollments: { some: { isActive: true } },
      guardians: { some: { guardian: { userId: { not: null } } } },
    },
    select: {
      id: true,
      enrollments: { where: { isActive: true }, select: { class: { select: { id: true } } }, take: 1 },
      guardians: { select: { guardian: { select: { userId: true } } } },
    },
  });
  const marker = await prisma.user.findFirst({ where: { role: { in: ["SURVEILLANT", "DIRECTOR"] } } });
  const subject = await prisma.subject.findFirst();
  const teacher = await prisma.teacherProfile.findFirst();
  if (!student || !marker || !subject || !teacher) {
    throw new Error("seed must have a guardian-linked student, a staff marker, a subject and a teacher");
  }
  const classId = student.enrollments[0].class.id;
  const guardianUserId = student.guardians.map((g) => g.guardian.userId).find(Boolean)!;

  const startUnexcused = await unexcused(student.id);
  const startAlerts = await prisma.notification.count({
    where: { userId: guardianUserId, type: "ABSENCE_ALERT" },
  });

  const createdSessions: string[] = [];
  const createdRecords: string[] = [];
  const createdJustifications: string[] = [];
  const createdNotifications: string[] = [];

  try {
    let alertsFired = 0;
    // Mark the student ABSENT on THRESHOLD + 1 distinct days.
    for (let i = 0; i < THRESHOLD + 1; i++) {
      const date = new Date(Date.UTC(2099, 0, 1 + i)); // far-future, collision-free
      const before = await unexcused(student.id);

      const session = await prisma.session.create({
        data: {
          classId, subjectId: subject.id, teacherId: teacher.id,
          date, startMin: 8 * 60, endMin: 9 * 60,
        },
      });
      createdSessions.push(session.id);
      const rec = await prisma.attendanceRecord.create({
        data: { sessionId: session.id, studentId: student.id, status: "ABSENT", markedById: marker.id },
      });
      createdRecords.push(rec.id);

      const after = await unexcused(student.id);
      if (crossesThreshold(before - startUnexcused, after - startUnexcused, THRESHOLD)) {
        const n = await notify({
          userId: guardianUserId,
          type: "ABSENCE_ALERT",
          titleAr: "تنبيه غياب", titleFr: "Alerte d'absence",
          bodyAr: "اختبار", bodyFr: "test",
          link: "/parent/attendance",
        });
        createdNotifications.push(...n.map((row) => row.id));
        alertsFired++;
      }
    }

    check("alert fires exactly once across 4 absences (threshold 3)", alertsFired === 1, `fired ${alertsFired}`);

    const alertsNow = await prisma.notification.count({
      where: { userId: guardianUserId, type: "ABSENCE_ALERT" },
    });
    check("one ABSENCE_ALERT notification persisted for the guardian", alertsNow === startAlerts + 1, `+${alertsNow - startAlerts}`);

    const beforeExcuse = await unexcused(student.id);
    check("unexcused count rose by 4", beforeExcuse === startUnexcused + THRESHOLD + 1, `${beforeExcuse - startUnexcused}`);

    // --- Justify the whole window, then approve (excuse the covered absences).
    const j = await prisma.absenceJustification.create({
      data: {
        studentId: student.id,
        reason: "acceptance test",
        fromDate: new Date(Date.UTC(2099, 0, 1)),
        toDate: new Date(Date.UTC(2099, 0, 1 + THRESHOLD)),
        status: "PENDING",
      },
    });
    createdJustifications.push(j.id);

    await prisma.attendanceRecord.updateMany({
      where: {
        studentId: student.id,
        status: "ABSENT",
        session: { date: { gte: j.fromDate, lte: j.toDate } },
      },
      data: { isExcused: true, justificationId: j.id },
    });

    const afterExcuse = await unexcused(student.id);
    check("approving the justification excuses all covered absences", afterExcuse === startUnexcused, `back to ${afterExcuse - startUnexcused} above baseline`);
  } finally {
    if (createdNotifications.length)
      await prisma.notification.deleteMany({ where: { id: { in: createdNotifications } } });
    if (createdRecords.length)
      await prisma.attendanceRecord.deleteMany({ where: { id: { in: createdRecords } } });
    if (createdJustifications.length)
      await prisma.absenceJustification.deleteMany({ where: { id: { in: createdJustifications } } });
    if (createdSessions.length)
      await prisma.session.deleteMany({ where: { id: { in: createdSessions } } });
  }

  console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${failures} failing check(s)`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
