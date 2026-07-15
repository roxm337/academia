import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { isLate } from "../lib/homework";

/**
 * Milestone 6 acceptance, against real database rows:
 *   - a submission after the due date is flagged late, before it is on time;
 *   - the teacher's grade + comment persist and the student sees them on the
 *     published homework;
 *   - a cahier-de-textes entry is readable from the class feed.
 * Cleans up everything it creates.
 *   npx tsx scripts/acceptance-homework.ts
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const assignment = await prisma.teacherAssignment.findFirst({
    include: { teacher: true, class: true, subject: true },
  });
  if (!assignment) throw new Error("seed a teacher assignment first");
  const { classId, subjectId, teacherId } = assignment;

  const enr = await prisma.enrollment.findFirst({
    where: { classId, isActive: true },
    select: { studentId: true },
  });
  if (!enr) throw new Error("assigned class has no active students");
  const studentId = enr.studentId;

  const createdHw: string[] = [];
  const createdCahier: string[] = [];
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

  try {
    // --- Late vs on-time -----------------------------------------------------
    const past = await prisma.homework.create({
      data: { classId, subjectId, teacherId, title: "__accept_past", instructions: "x", dueAt: yesterday, isPublished: true },
    });
    createdHw.push(past.id);
    const future = await prisma.homework.create({
      data: { classId, subjectId, teacherId, title: "__accept_future", instructions: "x", dueAt: tomorrow, isPublished: true },
    });
    createdHw.push(future.id);

    const lateSub = await prisma.homeworkSubmission.create({
      data: { homeworkId: past.id, studentId, isLate: isLate(past.dueAt, now), submittedAt: now, studentNote: "late one" },
    });
    const onTimeSub = await prisma.homeworkSubmission.create({
      data: { homeworkId: future.id, studentId, isLate: isLate(future.dueAt, now), submittedAt: now },
    });

    check("submission after the deadline is flagged late", lateSub.isLate === true);
    check("submission before the deadline is on time", onTimeSub.isLate === false);

    // --- Teacher review ------------------------------------------------------
    await prisma.homeworkSubmission.update({
      where: { id: lateSub.id },
      data: { grade: 15.5, teacherComment: "bien", reviewedAt: new Date() },
    });

    // --- Student sees the published homework with the grade ------------------
    const visible = await prisma.homework.findMany({
      where: { classId, isPublished: true, id: { in: createdHw } },
      include: { submissions: { where: { studentId } } },
    });
    const pastSeen = visible.find((h) => h.id === past.id);
    check("student sees the published homework", visible.length === 2);
    check(
      "teacher's grade is visible on the student's submission",
      Number(pastSeen?.submissions[0]?.grade) === 15.5 && pastSeen?.submissions[0]?.teacherComment === "bien",
      `grade=${pastSeen?.submissions[0]?.grade}`,
    );

    // --- Draft (unpublished) homework stays hidden ---------------------------
    const draft = await prisma.homework.create({
      data: { classId, subjectId, teacherId, title: "__accept_draft", instructions: "x", dueAt: tomorrow, isPublished: false },
    });
    createdHw.push(draft.id);
    const publishedForStudent = await prisma.homework.count({
      where: { classId, isPublished: true, id: draft.id },
    });
    check("an unpublished draft is not shown to students", publishedForStudent === 0);

    // --- Cahier de textes ----------------------------------------------------
    const entry = await prisma.cahierEntry.create({
      data: { classId, subjectId, teacherId, date: now, title: "__accept_lesson", description: "chapitre 3" },
    });
    createdCahier.push(entry.id);
    const feed = await prisma.cahierEntry.findMany({ where: { classId }, select: { id: true } });
    check("cahier entry appears in the class feed", feed.some((e) => e.id === entry.id));
  } finally {
    if (createdHw.length) {
      await prisma.homeworkSubmission.deleteMany({ where: { homeworkId: { in: createdHw } } });
      await prisma.homework.deleteMany({ where: { id: { in: createdHw } } });
    }
    if (createdCahier.length) {
      await prisma.cahierEntry.deleteMany({ where: { id: { in: createdCahier } } });
    }
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
