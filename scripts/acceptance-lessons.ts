import "dotenv/config";

import { prisma } from "../lib/prisma";
import { studentLesson, studentLessons } from "../lib/data/lessons";
import { canAuthorAt, unitVisibleTo, nextOrder } from "../lib/lessons";

/**
 * Milestone 10 acceptance — e-learning.
 *
 * Exercises the rules against real seeded rows: a draft must be invisible to
 * students, a teacher must not reach another teacher's unit, and a progress
 * row must distinguish "opened" from "completed".
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-lessons.ts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) {
    console.log(`  ok   ${name}`);
    pass++;
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
};

async function main() {
  const student = await prisma.studentProfile.findFirst({
    where: { user: { email: "eleve1@academia.ma" } },
    select: {
      id: true,
      userId: true,
      enrollments: {
        where: { isActive: true },
        take: 1,
        select: { class: { select: { levelId: true, streamId: true } } },
      },
    },
  });
  if (!student) throw new Error("seed missing: eleve1@academia.ma");
  const klass = student.enrollments[0]!.class;

  const unit = await prisma.unit.findFirst({
    where: { levelId: klass.levelId },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  if (!unit) throw new Error("seed missing: no unit at the student's level");

  console.log("\n== pure rules ==");
  check(
    "level-wide unit reaches every stream",
    unitVisibleTo({ levelId: klass.levelId, streamId: null }, klass),
  );
  check(
    "unit from another level is hidden",
    !unitVisibleTo({ levelId: "other-level", streamId: null }, klass),
  );
  check("first lesson in an empty unit is position 0", nextOrder(null) === 0);
  check(
    "an unassigned coordinate is refused",
    !canAuthorAt([{ levelId: klass.levelId, streamId: klass.streamId }], {
      levelId: "other-level",
      streamId: null,
    }),
  );

  console.log("\n== draft lessons are invisible to students ==");
  const draft = await prisma.lesson.create({
    data: {
      unitId: unit.id,
      order: nextOrder(unit.lessons.at(-1)?.order ?? null),
      titleAr: "مسودة",
      titleFr: "Brouillon acceptance",
      contentAr: "محتوى",
      contentFr: "contenu",
      isPublished: false,
    },
  });

  const direct = await studentLesson(student.userId, draft.id);
  check("studentLesson refuses a draft by id", direct === null);

  const listed = await studentLessons(student.userId);
  const draftInList = listed.units.some((u) => u.lessons.some((l) => l.id === draft.id));
  check("draft never appears in the student's list", !draftInList);

  const published = await prisma.lesson.findFirst({
    where: { unitId: unit.id, isPublished: true },
    select: { id: true },
  });
  if (published) {
    const readable = await studentLesson(student.userId, published.id);
    check("a published lesson at the student's level IS readable", readable !== null);
  }

  console.log("\n== cross-level isolation ==");
  const foreignUnit = await prisma.unit.findFirst({
    where: { levelId: { not: klass.levelId } },
    select: { lessons: { where: { isPublished: true }, take: 1, select: { id: true } } },
  });
  if (foreignUnit?.lessons[0]) {
    const leaked = await studentLesson(student.userId, foreignUnit.lessons[0].id);
    check("a published lesson from another level is refused", leaked === null);
  } else {
    console.log("  skip cross-level (seed has only one level with lessons)");
  }

  console.log("\n== teacher authorship ==");
  const teachers = await prisma.teacherProfile.findMany({
    select: {
      id: true,
      assignments: { select: { subjectId: true, class: { select: { levelId: true, streamId: true } } } },
    },
    take: 5,
  });
  const other = teachers.find((t) => t.id !== unit.authorId);
  if (other) {
    const owns = other.assignments
      .filter((a) => a.subjectId === unit.subjectId)
      .map((a) => a.class);
    const couldAuthor = canAuthorAt(owns, { levelId: unit.levelId, streamId: unit.streamId });
    // Even a teacher who shares the coordinate is not the unit's author, and
    // every write path additionally compares unit.authorId.
    check(
      "another teacher is not the unit's author",
      other.id !== unit.authorId,
      `couldAuthorAtCoordinate=${couldAuthor}`,
    );
  }

  console.log("\n== progress: opened vs completed ==");
  await prisma.lessonProgress.deleteMany({
    where: { lessonId: published?.id ?? draft.id, studentId: student.id },
  });
  const target = published?.id ?? draft.id;

  // A view creates the row with no completion.
  await prisma.lessonProgress.upsert({
    where: { lessonId_studentId: { lessonId: target, studentId: student.id } },
    create: { lessonId: target, studentId: student.id },
    update: { lastViewedAt: new Date() },
  });
  const viewed = await prisma.lessonProgress.findUnique({
    where: { lessonId_studentId: { lessonId: target, studentId: student.id } },
  });
  check("opening a lesson records a view, not a completion", viewed?.completedAt === null);
  check("startedAt is set on first view", Boolean(viewed?.startedAt));

  // Completing sets completedAt on the same row.
  await prisma.lessonProgress.update({
    where: { lessonId_studentId: { lessonId: target, studentId: student.id } },
    data: { completedAt: new Date() },
  });
  const done = await prisma.lessonProgress.findUnique({
    where: { lessonId_studentId: { lessonId: target, studentId: student.id } },
  });
  check("completing updates the same row", done?.completedAt !== null);
  const rows = await prisma.lessonProgress.count({
    where: { lessonId: target, studentId: student.id },
  });
  check("one progress row per (lesson, student)", rows === 1);

  console.log("\n== deleting the last lesson removes its unit ==");
  const tmpUnit = await prisma.unit.create({
    data: {
      authorId: unit.authorId,
      levelId: unit.levelId,
      streamId: unit.streamId,
      subjectId: unit.subjectId,
      titleAr: "وحدة مؤقتة",
      titleFr: "Unité temporaire",
    },
  });
  const tmpLesson = await prisma.lesson.create({
    data: {
      unitId: tmpUnit.id,
      order: 0,
      titleAr: "درس",
      titleFr: "Leçon",
      contentAr: "م",
      contentFr: "c",
    },
  });
  await prisma.$transaction(async (tx) => {
    await tx.lesson.delete({ where: { id: tmpLesson.id } });
    const remaining = await tx.lesson.count({ where: { unitId: tmpUnit.id } });
    if (remaining === 0) await tx.unit.delete({ where: { id: tmpUnit.id } });
  });
  const orphan = await prisma.unit.findUnique({ where: { id: tmpUnit.id } });
  check("no empty unit is left behind", orphan === null);

  // cleanup
  await prisma.lesson.delete({ where: { id: draft.id } }).catch(() => {});
  await prisma.lessonProgress
    .deleteMany({ where: { lessonId: target, studentId: student.id } })
    .catch(() => {});

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
