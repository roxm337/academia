import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { guessMapping, validateRows } from "../lib/massar";
import { readSheet } from "../lib/massar-sheet";

/**
 * Milestone 2 acceptance: import 200 students from an Excel file.
 *
 * The file is deliberately awkward — Arabic Massar headers, day-first dates,
 * Arabic genders, a shared guardian phone for siblings, plus a handful of rows
 * that are genuinely broken. A real Massar export looks like this; a clean
 * fixture would prove nothing.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MALE = ["أحمد", "محمد", "يوسف", "عمر", "مهدي", "أيوب", "حمزة", "أنس"];
const FEMALE = ["مريم", "سلمى", "خديجة", "إيمان", "سارة", "هاجر", "زينب", "لينا"];
const FAMILY = ["بنعلي", "العلوي", "الإدريسي", "بنجلون", "الطاهري", "الفاسي", "برادة"];

const TOTAL = 200;
const BAD_ROWS = 5; // deliberately broken, must be reported not imported

/** Same code the sheet builder uses, so a "duplicate" row really does collide. */
const codeOf = (i: number) =>
  `${String.fromCharCode(66 + (i % 20))}${String(200000000 + i).slice(0, 9)}`;

async function buildWorkbook(path: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("TABLEAU");

  // Arabic Massar headers, in a jumbled order — exactly what schools send.
  ws.addRow([
    "رمز مسار",
    "النسب",
    "الاسم",
    "تاريخ الازدياد",
    "الجنس",
    "مكان الازدياد",
    "ولي الأمر",
    "رقم الهاتف",
    "البريد الإلكتروني",
  ]);

  for (let i = 0; i < TOTAL; i++) {
    const male = i % 2 === 0;
    const famIdx = i % FAMILY.length;
    const code = codeOf(i);

    // Siblings: every 10th student reuses the previous guardian's phone.
    const guardianPhone = `+2126${String(10000000 + Math.floor(i / 2)).slice(0, 8)}`;

    const day = String((i % 28) + 1).padStart(2, "0");
    const month = String((i % 12) + 1).padStart(2, "0");

    const row = [
      code,
      FAMILY[famIdx],
      male ? MALE[i % MALE.length] : FEMALE[i % FEMALE.length],
      `${day}/${month}/2008`, // day-first, the Moroccan convention
      male ? "ذكر" : "أنثى",
      "مراكش",
      `${FAMILY[famIdx]} ${MALE[(i + 3) % MALE.length]}`,
      guardianPhone,
      i % 3 === 0 ? `parent${i}@example.ma` : "",
    ];

    // Break a few rows on purpose.
    if (i < BAD_ROWS) {
      if (i === 0) row[0] = "NOT-A-CODE"; // invalid Code Massar
      if (i === 1) row[0] = ""; // missing Code Massar
      if (i === 2) row[3] = "32/13/2008"; // impossible date
      if (i === 3) row[3] = ""; // missing birth date
      if (i === 4) row[0] = codeOf(5); // a genuine duplicate of row 5
    }

    ws.addRow(row);
  }

  await wb.xlsx.writeFile(path);
}

async function main() {
  const file = "/tmp/massar-200.xlsx";
  await buildWorkbook(file);
  console.log(`· built ${file} (${TOTAL} rows, ${BAD_ROWS} deliberately broken)\n`);

  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(file);

  const sheet = await readSheet(buffer, file);
  console.log("· headers read:", sheet.headers.join(" | "));
  console.log("· rows read:", sheet.rows.length);

  const mapping = guessMapping(sheet.headers);
  console.log("\n· column mapping guessed from Arabic headers:");
  sheet.headers.forEach((h, i) =>
    console.log(`    ${h.padEnd(18)} -> ${mapping[i] || "(ignored)"}`),
  );

  const rows = validateRows(sheet, mapping);
  const invalid = rows.filter((r) => r.errors.length > 0);
  console.log(`\n· validation: ${rows.length - invalid.length} valid, ${invalid.length} rejected`);
  for (const r of invalid) {
    console.log(`    row ${String(r.index).padStart(3)} -> ${r.errors.join(", ")}`);
  }

  const director = await prisma.user.findFirst({ where: { role: "DIRECTOR" } });
  const klass = await prisma.class.findFirst({ where: { name: "3AC - B" } });
  if (!director || !klass) throw new Error("seed the database first");

  const before = await prisma.studentProfile.count();

  // Import through the same module the Server Action calls.
  const { importStudents } = await import("../lib/data/import-students");
  const started = process.hrtime.bigint();
  const outcome = await importStudents({
    sheet,
    mapping,
    classId: klass.id,
    actorId: director.id,
  });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;

  const after = await prisma.studentProfile.count();
  const enrolled = await prisma.enrollment.count({
    where: { classId: klass.id, isActive: true },
  });
  const guardians = await prisma.guardian.count();
  const siblings = await prisma.guardian.findMany({
    where: { students: { some: {} } },
    select: { phone: true, _count: { select: { students: true } } },
  });
  const withTwoPlus = siblings.filter((g) => g._count.students >= 2).length;

  console.log("\n· import result:", outcome);
  console.log(`· took ${ms.toFixed(0)} ms`);
  console.log(`\n· students: ${before} -> ${after} (+${after - before})`);
  console.log(`· enrolled into "${klass.name}": ${enrolled}`);
  console.log(`· guardians total: ${guardians}, of which ${withTwoPlus} have 2+ children`);

  // Spot-check one imported student round-trips correctly.
  const sample = await prisma.studentProfile.findFirst({
    where: { codeMassar: { startsWith: "C" } },
    include: { user: true, guardians: { include: { guardian: true } } },
  });
  if (sample) {
    console.log("\n· spot check:");
    console.log(`    ${sample.codeMassar} — ${sample.user.lastNameAr} ${sample.user.firstNameAr}`);
    console.log(`    born ${sample.birthDate.toISOString().slice(0, 10)} · gender ${sample.gender}`);
    console.log(`    guardian: ${sample.guardians[0]?.guardian.phone ?? "none"}`);
  }

  const expectedImported = TOTAL - BAD_ROWS;
  console.log(
    `\n${outcome.imported === expectedImported ? "PASS" : "FAIL"}: expected ${expectedImported} imported, got ${outcome.imported}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
