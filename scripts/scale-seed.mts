import "dotenv/config";

import { prisma } from "../lib/prisma";

/**
 * Builds (or removes) a realistic-size school on top of the demo data.
 *
 * The seed has 26 students; a real Moroccan school is several hundred. Every
 * per-student loop in the app was written and measured against 26, which
 * proves nothing about 600.
 *
 * Everything it creates is tagged `SCALE-` so `down` can remove it exactly —
 * this never truncates and never touches the demo rows.
 *
 *   npx tsx --conditions=react-server scripts/scale-seed.mts up [classes] [perClass]
 *   npx tsx --conditions=react-server scripts/scale-seed.mts down
 */

const TAG = "SCALE-";
const MARK = "scale.test";

async function up(classCount: number, perClass: number) {
  const t0 = Date.now();
  const year = await prisma.schoolYear.findFirst({ where: { isCurrent: true } });
  const semester = await prisma.semester.findFirst({
    where: { schoolYearId: year?.id, isLocked: false },
    orderBy: { index: "asc" },
  });
  const level = await prisma.level.findFirst({ orderBy: { order: "asc" } });
  const subjects = await prisma.subject.findMany({ take: 6 });
  const teacher = await prisma.teacherProfile.findFirst();
  const director = await prisma.user.findFirst({ where: { role: "DIRECTOR" } });
  if (!year || !semester || !level || !teacher || !director || subjects.length === 0) {
    throw new Error("run the normal seed first");
  }

  console.log(
    `building ${classCount} classes x ${perClass} students = ${classCount * perClass} students`,
  );

  // Classes
  const classes = [];
  for (let c = 0; c < classCount; c++) {
    classes.push(
      await prisma.class.create({
        data: {
          name: `${TAG}C${String(c + 1).padStart(2, "0")}`,
          levelId: level.id,
          schoolYearId: year.id,
          capacity: perClass + 5,
        },
      }),
    );
  }

  // Every class is taught every subject by the same teacher — enough for the
  // coefficient lookup and the subject-scope filter to behave realistically.
  await prisma.teacherAssignment.createMany({
    data: classes.flatMap((k) =>
      subjects.map((s) => ({
        classId: k.id,
        subjectId: s.id,
        teacherId: teacher.id,
        schoolYearId: year.id,
      })),
    ),
    skipDuplicates: true,
  });

  // Students, in bulk
  let n = 0;
  for (const klass of classes) {
    const users = [];
    for (let i = 0; i < perClass; i++) {
      n++;
      users.push({
        email: `${TAG.toLowerCase()}${n}@${MARK}`,
        passwordHash: director.passwordHash,
        role: "STUDENT" as const,
        firstNameAr: "تلميذ",
        lastNameAr: `اختبار${n}`,
        firstNameFr: "Eleve",
        lastNameFr: `Test${n}`,
      });
    }
    await prisma.user.createMany({ data: users, skipDuplicates: true });
    const created = await prisma.user.findMany({
      where: { email: { in: users.map((u) => u.email) } },
      select: { id: true, email: true },
    });
    await prisma.studentProfile.createMany({
      data: created.map((u, i) => ({
        userId: u.id,
        // Deterministic and unique, in Massar's shape.
        codeMassar: `S${String(n - perClass + i + 1).padStart(9, "0")}`,
        birthDate: new Date("2010-09-01"),
      })),
      skipDuplicates: true,
    });
    const profiles = await prisma.studentProfile.findMany({
      where: { userId: { in: created.map((u) => u.id) } },
      select: { id: true },
    });
    await prisma.enrollment.createMany({
      data: profiles.map((p) => ({ studentId: p.id, classId: klass.id, isActive: true })),
      skipDuplicates: true,
    });
  }
  console.log(`  students created in ${Date.now() - t0}ms`);

  // Grades: 2 items per class+subject, a mark for every student.
  const tg = Date.now();
  for (const klass of classes) {
    const roster = await prisma.enrollment.findMany({
      where: { classId: klass.id, isActive: true },
      select: { studentId: true },
    });
    for (const subject of subjects) {
      for (let idx = 1; idx <= 2; idx++) {
        const item = await prisma.gradeItem.create({
          data: {
            classId: klass.id,
            subjectId: subject.id,
            semesterId: semester.id,
            index: idx,
            label: `${TAG}Controle ${idx}`,
            maxScore: 20,
            weight: 1,
            createdById: teacher.id,
          },
        });
        await prisma.grade.createMany({
          data: roster.map((r, i) => ({
            gradeItemId: item.id,
            studentId: r.studentId,
            // Spread 8–18 deterministically so averages and ranks vary.
            score: 8 + ((i * 7 + idx * 3) % 11),
            enteredById: director.id,
          })),
          skipDuplicates: true,
        });
      }
    }
  }
  console.log(`  grades created in ${Date.now() - tg}ms`);

  const students = await prisma.studentProfile.count();
  const grades = await prisma.grade.count();
  console.log(`\ntotal now: ${students} students, ${grades} grades (${Date.now() - t0}ms)`);
}

async function down() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: MARK } },
    select: { id: true },
  });
  // Cascades take profiles, enrolments and grades with them.
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await prisma.gradeItem.deleteMany({ where: { label: { startsWith: TAG } } });
  await prisma.class.deleteMany({ where: { name: { startsWith: TAG } } });
  console.log(
    `removed ${users.length} scale users; ${await prisma.studentProfile.count()} students remain`,
  );
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "up") await up(Number(a ?? 20), Number(b ?? 30));
else if (mode === "down") await down();
else console.error("usage: scale-seed.mts up [classes] [perClass] | down");

await prisma.$disconnect();
