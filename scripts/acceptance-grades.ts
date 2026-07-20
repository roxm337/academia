import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  subjectAverage,
  generalAverage,
  mentionFor,
  rankByAverage,
  round2,
} from "../lib/grades";
import { renderBulletinPdf } from "../lib/pdf/bulletin";

/**
 * Milestone 5 acceptance, against real database rows:
 *   - enter grades for two coefficient-weighted subjects, and the general
 *     average comes out as Σ(subjectAvg × coef) / Σ(coef);
 *   - the class rank and Moroccan mention are correct;
 *   - a bilingual bulletin PDF renders.
 * Cleans up the grade items it creates.
 *   npx tsx scripts/acceptance-grades.ts
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
  const year = await prisma.schoolYear.findFirst({ where: { isCurrent: true } });
  const semester = await prisma.semester.findFirst({
    where: { schoolYear: { isCurrent: true }, index: 1 },
  });
  if (!year || !semester) throw new Error("seed the database first");

  // A class whose level carries at least two subject coefficients, with ≥2 students.
  const classes = await prisma.class.findMany({
    where: { schoolYearId: year.id },
    select: { id: true, name: true, levelId: true, streamId: true },
  });

  let picked:
    | { classId: string; className: string; subjects: { id: string; code: string; nameAr: string; nameFr: string; coef: number }[]; students: { id: string; codeMassar: string; firstNameFr: string; lastNameFr: string }[] }
    | null = null;

  for (const c of classes) {
    const coefRows = await prisma.levelSubject.findMany({
      where: { levelId: c.levelId, OR: [{ streamId: c.streamId }, { streamId: null }] },
      include: { subject: true },
    });
    // Resolve to one coefficient per subject (stream-specific wins).
    const bySubject = new Map<string, { subject: typeof coefRows[number]["subject"]; coef: number }>();
    for (const r of coefRows) {
      const streamSpecific = r.streamId === c.streamId && c.streamId !== null;
      if (!bySubject.has(r.subjectId) || streamSpecific) {
        bySubject.set(r.subjectId, { subject: r.subject, coef: Number(r.coefficient) });
      }
    }
    const subs = [...bySubject.values()].filter((s) => s.coef > 0).slice(0, 2);
    if (subs.length < 2) continue;

    const roster = await prisma.enrollment.findMany({
      where: { classId: c.id, isActive: true },
      select: { student: { select: { id: true, codeMassar: true, user: { select: { firstNameFr: true, lastNameFr: true } } } } },
      take: 3,
    });
    if (roster.length < 2) continue;

    picked = {
      classId: c.id,
      className: c.name,
      subjects: subs.map((s) => ({ id: s.subject.id, code: s.subject.code, nameAr: s.subject.nameAr, nameFr: s.subject.nameFr, coef: s.coef })),
      students: roster.map((r) => ({ id: r.student.id, codeMassar: r.student.codeMassar, firstNameFr: r.student.user.firstNameFr, lastNameFr: r.student.user.lastNameFr })),
    };
    break;
  }

  if (!picked) throw new Error("no class with ≥2 coefficient subjects and ≥2 students");

  const [A, B] = picked.subjects;
  const [S1, S2] = picked.students;
  const cA = A.coef;
  const cB = B.coef;
  console.log(`· class ${picked.className}: ${A.code}(coef ${cA}) + ${B.code}(coef ${cB})\n`);

  const createdItems: string[] = [];
  try {
    // One /20 evaluation per subject.
    const marker = await prisma.user.findFirst({ where: { role: "DIRECTOR" }, select: { id: true } });
    const scores: Record<string, Record<string, number>> = {
      [A.id]: { [S1.id]: 16, [S2.id]: 10 },
      [B.id]: { [S1.id]: 12, [S2.id]: 10 },
    };
    for (const subj of [A, B]) {
      const item = await prisma.gradeItem.create({
        data: { classId: picked.classId, subjectId: subj.id, semesterId: semester.id, kind: "CONTROLE", index: 99, maxScore: 20, weight: 1 },
      });
      createdItems.push(item.id);
      for (const [studentId, score] of Object.entries(scores[subj.id])) {
        await prisma.grade.create({ data: { gradeItemId: item.id, studentId, score, enteredById: marker!.id } });
      }
    }

    // Compute S1 and S2 from JUST these subjects (they have no other grades).
    const compute = (sid: string) => {
      const subjResults = [A, B].map((subj) => ({
        average: subjectAverage([{ score: scores[subj.id][sid] ?? null, maxScore: 20, weight: 1 }]),
        coefficient: subj.coef,
      }));
      return generalAverage(subjResults);
    };
    const g1 = compute(S1.id);
    const g2 = compute(S2.id);

    const expected1 = round2((16 * cA + 12 * cB) / (cA + cB));
    check("S1 general average = Σ(avg×coef)/Σ(coef)", g1 === expected1, `got ${g1}, expected ${expected1}`);
    check("S2 general average = 10.00", g2 === 10, `got ${g2}`);

    const ranked = rankByAverage([
      { id: S1.id, average: g1 },
      { id: S2.id, average: g2 },
    ]);
    const r1 = ranked.find((r) => r.id === S1.id)!.rank;
    const r2 = ranked.find((r) => r.id === S2.id)!.rank;
    check("higher average ranks first", r1 === 1 && r2 === 2, `S1=${r1} S2=${r2}`);
    check("S2 mention is PASSABLE (10/20)", mentionFor(g2) === "PASSABLE", `${mentionFor(g2)}`);

    // Render S1's bulletin.
    const pdf = await renderBulletinPdf({
      locale: "ar",
      schoolName: "أكاديميا",
      student: { name: `${S1.firstNameFr} ${S1.lastNameFr}`, codeMassar: S1.codeMassar },
      className: picked.className,
      yearLabel: year.label,
      semesterLabel: "الأسدس 1",
      subjects: [A, B].map((subj) => ({ name: subj.nameAr, coefficient: subj.coef, average: subjectAverage([{ score: scores[subj.id][S1.id], maxScore: 20, weight: 1 }]) })),
      general: g1,
      mention: "حسن",
      rank: r1,
      classSize: picked.students.length,
      stats: { average: round2(((g1 ?? 0) + (g2 ?? 0)) / 2), min: g2, max: g1 },
      labels: { bulletin: "كشف النقط", subject: "المادة", coefficient: "المعامل", average: "المعدل", appreciation: "ملاحظة", generalAverage: "المعدل العام", rank: "الرتبة", mention: "الميزة", classAverage: "معدل القسم", min: "الأدنى", max: "الأعلى", notGraded: "—", of: "من", councilDecision: "قرار المجلس", directorAppreciation: "ملاحظة المدير" },
    });
    const magic = Buffer.from(pdf.slice(0, 5)).toString("latin1");
    check("Arabic bulletin PDF renders", magic === "%PDF-" && pdf.length > 1000, `${magic}, ${pdf.length} bytes`);
  } finally {
    if (createdItems.length) {
      await prisma.grade.deleteMany({ where: { gradeItemId: { in: createdItems } } });
      await prisma.gradeItem.deleteMany({ where: { id: { in: createdItems } } });
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
