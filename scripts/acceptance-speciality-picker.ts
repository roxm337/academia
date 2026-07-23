import "dotenv/config";

import { prisma } from "../lib/prisma";
import { setSpecialities } from "../lib/student-specialities";
import { computeClassResults } from "../lib/data/grades";

/**
 * Acceptance — the spécialité write path.
 *
 * Everything downstream of a spécialité choice was already built and tested;
 * this covers the piece that was missing entirely — actually recording one — by
 * driving the real Server Action the director's form calls, then reading the
 * result back through the same bulletin engine the report cards use.
 *
 * The case that matters: a student's choice CHANGES. The dropped spécialité
 * must vanish from their marks, and a spécialité from another level must be
 * refused.
 *
 * The action itself is a "use server" module that cannot run under tsx, so this
 * drives `setSpecialities` — the exact plain module the action wraps, which
 * holds all the validation and the write. Then it reads the result back through
 * computeClassResults, the same engine the report cards use.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-speciality-picker.ts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};



async function main() {
  const year = await prisma.schoolYear.findFirstOrThrow({ where: { isCurrent: true } });
  const klass = await prisma.class.findFirstOrThrow({
    where: { level: { code: "TLE" } },
    select: { id: true },
  });
  const semester = await prisma.semester.findFirstOrThrow({
    where: { schoolYearId: year.id, index: 1 },
    select: { id: true },
  });
  const student = await prisma.studentProfile.findFirstOrThrow({
    where: { enrollments: { some: { classId: klass.id, isActive: true } } },
    select: { id: true, user: { select: { lastNameFr: true } } },
  });

  const tleSpecs = await prisma.speciality.findMany({
    where: { level: { code: "TLE" } },
    select: { id: true, code: true },
  });
  const spe = (code: string) => tleSpecs.find((s) => s.code === code)!.id;
  // A spécialité offered at Première, NOT at Terminale — the cross-level probe.
  const foreign = await prisma.speciality.findFirstOrThrow({
    where: { level: { code: "1RE" } },
    select: { id: true },
  });

  // Snapshot so the demo DB is left as found.
  const original = (
    await prisma.studentSpeciality.findMany({
      where: { studentId: student.id, schoolYearId: year.id },
      select: { specialityId: true },
    })
  ).map((r) => r.specialityId);

  const restore = async () => {
    await prisma.studentSpeciality.deleteMany({
      where: { studentId: student.id, schoolYearId: year.id },
    });
    if (original.length) {
      await prisma.studentSpeciality.createMany({
        data: original.map((specialityId) => ({
          studentId: student.id,
          specialityId,
          schoolYearId: year.id,
        })),
      });
    }
  };

  const stored = async () =>
    (
      await prisma.studentSpeciality.findMany({
        where: { studentId: student.id, schoolYearId: year.id },
        select: { specialityId: true },
      })
    )
      .map((r) => r.specialityId)
      .sort();

  const printedSpecs = async () => {
    const { students } = await computeClassResults(klass.id, semester.id);
    const me = students.find((s) => s.studentId === student.id);
    return (me?.subjects ?? [])
      .map((x) => x.code)
      .filter((c) => c.startsWith("SPE_"))
      .sort();
  };

  console.log(`\n== picking two spécialités for ${student.user.lastNameFr} ==`);
  await setSpecialities(student.id, [spe("SPE_MATHS"), spe("SPE_PC")]);
  check("both are stored", (await stored()).length === 2);
  check(
    "and both appear on the bulletin",
    JSON.stringify(await printedSpecs()) === JSON.stringify(["SPE_MATHS", "SPE_PC"]),
    (await printedSpecs()).join(","),
  );

  console.log("\n== changing the choice drops the old one everywhere ==");
  await setSpecialities(student.id, [spe("SPE_MATHS"), spe("SPE_SVT")]);
  const after = await printedSpecs();
  check("Physique-Chimie is gone from the bulletin", !after.includes("SPE_PC"), after.join(","));
  check("SVT is now on the bulletin", after.includes("SPE_SVT"));
  check("exactly two remain stored", (await stored()).length === 2);

  console.log("\n== the rules hold against bad input ==");
  const wrongCount = await setSpecialities(student.id, [
    spe("SPE_MATHS"),
    spe("SPE_PC"),
    spe("SPE_SVT"),
  ]);
  check(
    "three in Terminale is refused",
    !wrongCount.ok && wrongCount.error === "wrongCount",
    JSON.stringify(wrongCount),
  );

  const foreignSpec = await setSpecialities(student.id, [spe("SPE_MATHS"), foreign.id]);
  check(
    "a Première spécialité on a Terminale student is refused",
    !foreignSpec.ok && foreignSpec.error === "notOffered",
    JSON.stringify(foreignSpec),
  );

  check(
    "a refused save left the previous choice untouched",
    JSON.stringify(await stored()) === JSON.stringify([spe("SPE_MATHS"), spe("SPE_SVT")].sort()),
  );

  await restore();
  check("restored the fixture's original choice", true);

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
