import "dotenv/config";

import { prisma } from "../lib/prisma";
import { computeClassResults } from "../lib/data/grades";
import { snapshotClass, finalizeSemester, unfinalizeSemester } from "../lib/council-archive";
import { councilForClass } from "../lib/data/council";

/**
 * Times the operations that do per-student work, at real school size.
 *
 * Budget: anything a director triggers and waits on should stay well under a
 * proxy's typical 30s timeout, and ideally under ~5s to not feel broken.
 *
 * Run: npx tsx --conditions=react-server scripts/scale-measure.mts
 */

const results: { op: string; ms: number; note: string }[] = [];

async function time<T>(op: string, note: string, run: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const out = await run();
  const ms = Date.now() - t0;
  results.push({ op, ms, note });
  console.log(`  ${String(ms).padStart(6)}ms  ${op}  (${note})`);
  return out;
}

async function main() {
  const students = await prisma.studentProfile.count();
  const semester = await prisma.semester.findFirst({ where: { isLocked: false }, orderBy: { index: "asc" } });
  const klass = await prisma.class.findFirst({
    where: { name: { startsWith: "SCALE-" } },
    select: { id: true, name: true },
  });
  const classCount = await prisma.class.count();
  if (!semester || !klass) throw new Error("run scale-seed.mts up first");

  console.log(`\nscale: ${students} students, ${classCount} classes, semester ${semester.index}\n`);

  console.log("== reads ==");
  await time("computeClassResults", "one 30-student class", () =>
    computeClassResults(klass.id, semester.id),
  );
  await time("councilForClass", "the council screen", () =>
    councilForClass(klass.id, semester.id),
  );

  console.log("\n== writes ==");
  await time("snapshotClass", "archive one class", () => snapshotClass(klass.id, semester.id));

  console.log("\n== the whole-semester operation the director waits on ==");
  const archived = await time("finalizeSemester", `all ${classCount} classes`, () =>
    finalizeSemester(semester.id),
  );
  console.log(`         -> ${archived} results archived`);

  // The booklet needs next-intl's request context (getTranslations), which
  // only exists inside a request — it is measured over HTTP instead, by
  // scale-measure-http.sh, which is the real path anyway.

  // Leave the data as it was found.
  await unfinalizeSemester(semester.id);
  await prisma.semesterResult.deleteMany({ where: { semesterId: semester.id } });

  console.log("\n== verdict ==");
  const worst = results.reduce((a, b) => (a.ms > b.ms ? a : b));
  for (const r of results) {
    const flag = r.ms > 5000 ? "SLOW" : r.ms > 1500 ? "watch" : "ok";
    console.log(`  ${flag.padEnd(6)} ${r.op} — ${r.ms}ms (${r.note})`);
  }
  console.log(`\n  slowest: ${worst.op} at ${worst.ms}ms`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
