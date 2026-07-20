import "dotenv/config";

import { prisma } from "../lib/prisma";
import { finalizeSemester, unfinalizeSemester } from "../lib/council-archive";
import { computeClassResults } from "../lib/data/grades";
import { frozenResult, councilForClass } from "../lib/data/council";
import { parseBreakdown, suggestDecision } from "../lib/council";

/**
 * Acceptance for the conseil de classe.
 *
 * The claim being tested is the whole point of the feature: once a semester is
 * finalised, a bulletin reprinted later shows the SAME numbers, even though the
 * live computation would now produce different ones. So this archives a class,
 * then deliberately changes the world underneath it — removes a classmate,
 * which shifts every rank and the class average — and checks the archive did
 * not move.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-council.mts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};

const restore: Array<() => Promise<unknown>> = [];

async function main() {
  const semester = await prisma.semester.findFirst({
    where: { isLocked: false },
    orderBy: { index: "asc" },
  });
  if (!semester) throw new Error("seed missing: an unlocked semester");

  const klass = await prisma.class.findFirst({
    where: { enrollments: { some: { isActive: true } }, gradeItems: { some: { semesterId: semester.id } } },
    select: { id: true, name: true },
  });
  if (!klass) throw new Error("seed missing: a class with grade items this semester");

  // Start from a clean archive for this semester so reruns are deterministic.
  await prisma.semesterResult.deleteMany({ where: { semesterId: semester.id } });

  const live = await computeClassResults(klass.id, semester.id);
  const graded = live.students.filter((s) => s.general !== null);
  if (graded.length < 2) throw new Error("seed missing: at least two graded students");

  console.log(`\n== before the council (${klass.name}, live) ==`);
  check("the class has live results", graded.length >= 2, `${graded.length} graded`);
  check("nothing is archived yet", (await prisma.semesterResult.count({ where: { semesterId: semester.id } })) === 0);

  const subject = graded[0];
  const before = await councilForClass(klass.id, semester.id);
  const subjectRow = before.rows.find((r) => r.studentId === subject.studentId)!;
  check(
    "the council view proposes a decision from the average",
    subjectRow.suggestion === suggestDecision(subject.general),
    `suggestion=${subjectRow.suggestion} for ${subject.general}`,
  );
  check("no decision is recorded yet", subjectRow.decision === null);
  check("the row is not frozen", subjectRow.frozen === false);

  console.log("\n== the council records a decision ==");
  await prisma.semesterResult.upsert({
    where: { studentId_semesterId: { studentId: subject.studentId, semesterId: semester.id } },
    update: { councilDecision: "ENCOURAGEMENTS", directorAppreciation: "Bon semestre." },
    create: {
      studentId: subject.studentId,
      semesterId: semester.id,
      classId: klass.id,
      councilDecision: "ENCOURAGEMENTS",
      directorAppreciation: "Bon semestre.",
    },
  });
  restore.push(() => prisma.semesterResult.deleteMany({ where: { semesterId: semester.id } }));

  console.log("\n== finalising archives every student ==");
  const archived = await finalizeSemester(semester.id);
  check("every enrolled student got a row", archived > 0, `${archived} archived`);

  const stored = await prisma.semesterResult.findUnique({
    where: { studentId_semesterId: { studentId: subject.studentId, semesterId: semester.id } },
  });
  check("the row is marked final", stored?.isFinal === true);
  check(
    "the archived average matches what was live",
    Number(stored?.generalAverage) === subject.general,
    `${stored?.generalAverage} vs ${subject.general}`,
  );
  check("the archived rank matches", stored?.rank === subject.rank);
  check(
    "refreshing the figures did NOT wipe the council's words",
    stored?.councilDecision === "ENCOURAGEMENTS" && stored?.directorAppreciation === "Bon semestre.",
    `decision=${stored?.councilDecision}`,
  );

  const breakdown = parseBreakdown(stored?.subjectBreakdown);
  check("the per-subject breakdown was stored", breakdown.subjects.length > 0, `${breakdown.subjects.length} subjects`);
  check(
    "coefficients were frozen alongside the marks",
    breakdown.subjects.every((s) => typeof s.coefficient === "number"),
  );
  check(
    "both language names are in the archive",
    breakdown.subjects.every((s) => Boolean(s.nameAr) && Boolean(s.nameFr)),
  );

  console.log("\n== the archive survives the world changing underneath it ==");
  const archivedAverage = Number(stored?.generalAverage);
  const archivedRank = stored?.rank ?? null;
  const archivedClassSize = stored?.classSize ?? 0;

  // Remove a different student from the class. Live, this changes the class
  // size, the class average, and every rank below the one removed.
  const victim = graded.find((s) => s.studentId !== subject.studentId)!;
  const enrolment = await prisma.enrollment.findFirst({
    where: { studentId: victim.studentId, classId: klass.id, isActive: true },
    select: { id: true },
  });
  if (!enrolment) throw new Error("expected an active enrolment to deactivate");
  await prisma.enrollment.update({ where: { id: enrolment.id }, data: { isActive: false } });
  restore.push(() => prisma.enrollment.update({ where: { id: enrolment.id }, data: { isActive: true } }));

  // Guard against a vacuous test: unless the LIVE numbers actually moved,
  // "the archive did not move" proves nothing at all.
  const relive = await computeClassResults(klass.id, semester.id);
  check(
    "the live class size really did change (otherwise this test proves nothing)",
    relive.students.length !== archivedClassSize,
    `live=${relive.students.length} archived=${archivedClassSize}`,
  );

  const frozen = await frozenResult(subject.studentId, semester.id);
  check("the frozen result is still served", frozen !== null);
  check(
    "the archived average did not move",
    frozen?.snapshot.generalAverage === archivedAverage,
    `${frozen?.snapshot.generalAverage} vs ${archivedAverage}`,
  );
  check(
    "the archived rank did not move",
    frozen?.snapshot.rank === archivedRank,
    `${frozen?.snapshot.rank} vs ${archivedRank}`,
  );
  check(
    "the archived class size did not move",
    frozen?.snapshot.classSize === archivedClassSize,
    `${frozen?.snapshot.classSize} vs ${archivedClassSize}`,
  );
  check(
    "the council's decision is carried with it",
    frozen?.councilDecision === "ENCOURAGEMENTS",
  );

  console.log("\n== unlocking keeps the council's work ==");
  await unfinalizeSemester(semester.id);
  const afterUnlock = await prisma.semesterResult.findUnique({
    where: { studentId_semesterId: { studentId: subject.studentId, semesterId: semester.id } },
  });
  check("rows are no longer final", afterUnlock?.isFinal === false);
  check(
    "the decision survived the unlock",
    afterUnlock?.councilDecision === "ENCOURAGEMENTS",
    "re-running a council meeting because of an unlock would be unacceptable",
  );
  check(
    "an un-final row is not served as frozen",
    (await frozenResult(subject.studentId, semester.id)) === null,
  );

  console.log("\n== cleanup ==");
  for (const undo of restore.reverse()) await undo();
  console.log("  ok   test data removed");

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  for (const undo of restore.reverse()) await undo().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
