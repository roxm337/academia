import "dotenv/config";

import { prisma } from "../lib/prisma";
import { computeClassResults } from "../lib/data/grades";
import { generalAverage } from "../lib/grades";

/**
 * Acceptance — the 2019 reform, where it actually bites.
 *
 * Two students sit in the same Terminale room. One took Maths + Physique-Chimie,
 * the other Physique-Chimie + SVT. The seed marks every student in all three
 * spécialités, so nothing but the choice itself can keep them apart.
 *
 * What must hold:
 *   - a spécialité a student did not choose never appears on their bulletin;
 *   - it is not in the denominator of their general average either — at
 *     coefficient 16 an untaken subject would swamp the result;
 *   - the tronc commun is on everyone's;
 *   - classmates therefore get genuinely different subject lists.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-specialites.ts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};

async function main() {
  const klass = await prisma.class.findFirst({
    where: { level: { code: "TLE" } },
    select: { id: true, name: true },
  });
  const semester = await prisma.semester.findFirst({
    where: { schoolYear: { isCurrent: true }, index: 1 },
    select: { id: true },
  });
  if (!klass || !semester) throw new Error("seed a Terminale class and a trimestre first");

  const chosen = await prisma.studentSpeciality.findMany({
    where: { student: { enrollments: { some: { classId: klass.id, isActive: true } } } },
    select: { studentId: true, speciality: { select: { code: true } } },
  });
  const byStudent = new Map<string, string[]>();
  for (const c of chosen) {
    byStudent.set(c.studentId, [...(byStudent.get(c.studentId) ?? []), c.speciality.code]);
  }

  const { students } = await computeClassResults(klass.id, semester.id);
  check("the Terminale class has students with results", students.length > 0, `${students.length}`);

  console.log("\n== a bulletin carries only the spécialités the student chose ==");
  const ALL_SPE = ["SPE_MATHS", "SPE_PC", "SPE_SVT"];
  let checkedStudents = 0;
  for (const s of students) {
    const mine = byStudent.get(s.studentId) ?? [];
    if (mine.length === 0) continue;
    checkedStudents++;
    const printed = s.subjects.map((x) => x.code);
    const missing = mine.filter((code) => !printed.includes(code));
    const leaked = ALL_SPE.filter((code) => !mine.includes(code) && printed.includes(code));
    check(
      `${s.lastNameFr}: has ${mine.map((m) => m.replace("SPE_", "")).join("+")}`,
      missing.length === 0 && leaked.length === 0,
      `missing=[${missing}] leaked=[${leaked}]`,
    );
    if (checkedStudents >= 4) break;
  }
  check("several students were actually checked", checkedStudents >= 4, `${checkedStudents}`);

  console.log("\n== classmates get different subject lists ==");
  const lists = students
    .map((s) => s.subjects.map((x) => x.code).sort().join(","))
    .filter(Boolean);
  const distinct = new Set(lists);
  check(
    "the same room produces more than one subject list",
    distinct.size > 1,
    `${distinct.size} distinct lists among ${lists.length} students`,
  );

  console.log("\n== the general average ignores what was not taken ==");
  const sample = students.find((s) => (byStudent.get(s.studentId) ?? []).length > 0);
  if (sample) {
    const recomputed = generalAverage(
      sample.subjects.map((x) => ({ average: x.average, coefficient: x.coefficient })),
    );
    check(
      "the stored average equals one recomputed from the printed rows only",
      recomputed === sample.general,
      `printed=${sample.general} recomputed=${recomputed}`,
    );

    // The falsifying comparison: fold in a spécialité they did not take and the
    // number must move. If it does not, the filter is not doing anything.
    const notMine = ALL_SPE.find((c) => !(byStudent.get(sample.studentId) ?? []).includes(c));
    const intruder = students
      .flatMap((s) => s.subjects)
      .find((x) => x.code === notMine && x.average !== null);
    if (intruder) {
      const polluted = generalAverage([
        ...sample.subjects.map((x) => ({ average: x.average, coefficient: x.coefficient })),
        { average: intruder.average, coefficient: intruder.coefficient },
      ]);
      check(
        `adding the untaken ${notMine?.replace("SPE_", "")} would change the average`,
        polluted !== sample.general,
        `would become ${polluted} instead of ${sample.general} — if equal, this test proves nothing`,
      );
    } else {
      check("found an untaken spécialité with marks to test against", false, "none");
    }
  } else {
    check("found a student with spécialités", false, "none");
  }

  console.log("\n== the tronc commun is on every bulletin ==");
  for (const s of students.slice(0, 3)) {
    const printed = s.subjects.map((x) => x.code);
    check(
      `${s.lastNameFr} has Philosophie and Histoire-Géo`,
      printed.includes("PHILO") && printed.includes("HG"),
      `[${printed}]`,
    );
  }

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
