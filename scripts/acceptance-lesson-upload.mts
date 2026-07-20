import "dotenv/config";

import { prisma } from "../lib/prisma";
import { MAX_UPLOAD_BYTES } from "../lib/storage";
import { attachFiles } from "../lib/lesson-attachments";

/**
 * Multi-file lesson attachments.
 *
 * The behaviour that matters is partial failure: a teacher attaching a
 * worksheet plus one oversized scan must keep the worksheet and be told about
 * the scan — not lose both.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-lesson-upload.mts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};

const pdf = (name: string, bytes: number) =>
  new File([new Uint8Array(bytes).fill(65)], name, { type: "application/pdf" });

async function main() {
  const lesson = await prisma.lesson.findFirst({ select: { id: true } });
  const uploader = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    select: { id: true },
  });
  if (!lesson || !uploader) throw new Error("seed missing: a lesson and a teacher");

  const before = await prisma.lessonAttachment.count({ where: { lessonId: lesson.id } });
  const trackNew = async () => {
    const rows = await prisma.lessonAttachment.findMany({
      where: { lessonId: lesson.id },
      select: { id: true, fileId: true },
      orderBy: { createdAt: "desc" },
    });
    return rows;
  };

  console.log("\n== several files in one save ==");
  const fd = new FormData();
  fd.append("file", pdf("cours.pdf", 1024));
  fd.append("file", pdf("exercices.pdf", 2048));
  const err = await attachFiles(fd, lesson.id, uploader.id);
  check("no error when every file is acceptable", err === null, String(err?.error));
  const afterBoth = await prisma.lessonAttachment.count({ where: { lessonId: lesson.id } });
  check("both files attached in one save", afterBoth === before + 2, `${before} -> ${afterBoth}`);

  console.log("\n== partial failure keeps the good files ==");
  const mixed = new FormData();
  mixed.append("file", pdf("corrige.pdf", 512));
  mixed.append("file", pdf("scan-enorme.pdf", MAX_UPLOAD_BYTES + 1));
  const mixedErr = await attachFiles(mixed, lesson.id, uploader.id);
  check("the oversized file is reported", mixedErr?.error === "tooLarge", String(mixedErr?.error));
  const afterMixed = await prisma.lessonAttachment.count({ where: { lessonId: lesson.id } });
  check(
    "the acceptable file was still saved",
    afterMixed === afterBoth + 1,
    `${afterBoth} -> ${afterMixed}`,
  );

  console.log("\n== a disallowed type is refused ==");
  const bad = new FormData();
  bad.append("file", new File([new Uint8Array(16)], "script.exe", { type: "application/x-msdownload" }));
  const badErr = await attachFiles(bad, lesson.id, uploader.id);
  check("bad mime type rejected", badErr?.error === "badType", String(badErr?.error));
  const afterBad = await prisma.lessonAttachment.count({ where: { lessonId: lesson.id } });
  check("nothing was stored for it", afterBad === afterMixed);

  console.log("\n== empty input is a no-op, not an error ==");
  const empty = new FormData();
  check("no error with no files", (await attachFiles(empty, lesson.id, uploader.id)) === null);

  console.log("\n== cleanup ==");
  const rows = await trackNew();
  const toRemove = rows.slice(0, afterBad - before);
  await prisma.lessonAttachment.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } });
  await prisma.storedFile.deleteMany({ where: { id: { in: toRemove.map((r) => r.fileId) } } });
  const restored = await prisma.lessonAttachment.count({ where: { lessonId: lesson.id } });
  check("attachment count back to where it started", restored === before, `${restored} vs ${before}`);

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
