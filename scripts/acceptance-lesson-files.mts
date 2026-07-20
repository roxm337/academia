import "dotenv/config";

import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.js";

/**
 * Verifies the publish gate at the FILE layer, not just the page layer: a
 * resource attached to a draft lesson must not be downloadable by a student
 * who cannot see the lesson.
 *
 * Needs the app running (npm start). Run: npx tsx scripts/acceptance-lesson-files.mts
 */

const BASE = "http://localhost:3000";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};

async function login(email: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const jar = (csrfRes.headers.getSetCookie() ?? []).map((c) => c.split(";")[0]).join("; ");

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: jar },
    body: new URLSearchParams({ csrfToken, email, password: "Passw0rd!", redirect: "false" }),
    redirect: "manual",
  });
  const session = (res.headers.getSetCookie() ?? []).map((c) => c.split(";")[0]).join("; ");
  return [jar, session].filter(Boolean).join("; ");
}

const status = async (url: string, cookie: string) =>
  (await fetch(`${BASE}${url}`, { headers: { cookie }, redirect: "manual" })).status;

async function main() {
  const draft = await prisma.lesson.findFirst({
    where: { isPublished: false },
    select: { id: true },
  });
  const published = await prisma.lesson.findFirst({
    where: { isPublished: true },
    select: { id: true },
  });
  if (!draft || !published) throw new Error("seed must contain a draft AND a published lesson");

  // Two real files on disk, one attached to each lesson.
  const root = process.env.STORAGE_LOCAL_DIR ?? "./storage";
  const made: string[] = [];
  const attach = async (lessonId: string, tag: string) => {
    const key = `lessons/${lessonId}/acceptance-${tag}.pdf`;
    const full = path.join(root, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, "%PDF-1.4 acceptance\n");
    made.push(full);
    const file = await prisma.storedFile.create({
      data: { path: key, filename: `${tag}.pdf`, mimeType: "application/pdf", size: 20 },
    });
    await prisma.lessonAttachment.create({ data: { lessonId, fileId: file.id } });
    return { key, fileId: file.id };
  };

  const draftFile = await attach(draft.id, "draft");
  const publishedFile = await attach(published.id, "published");

  const studentCookie = await login("eleve1@academia.ma");
  const teacherCookie = await login("prof.maths@academia.ma");
  const parentCookie = await login("parent1@academia.ma");

  console.log("\n== lesson attachments respect the publish gate ==");
  check(
    "student is refused a DRAFT lesson's resource",
    (await status(`/api/files/${draftFile.key}`, studentCookie)) === 403,
    `got ${await status(`/api/files/${draftFile.key}`, studentCookie)}`,
  );
  check(
    "parent is refused a DRAFT lesson's resource",
    (await status(`/api/files/${draftFile.key}`, parentCookie)) === 403,
  );
  check(
    "teacher CAN read the draft's resource (their own review copy)",
    (await status(`/api/files/${draftFile.key}`, teacherCookie)) === 200,
  );
  check(
    "student CAN read a PUBLISHED lesson's resource",
    (await status(`/api/files/${publishedFile.key}`, studentCookie)) === 200,
  );
  check(
    "anonymous is refused entirely",
    (await status(`/api/files/${publishedFile.key}`, "")) === 401,
  );

  // cleanup
  await prisma.storedFile.deleteMany({
    where: { id: { in: [draftFile.fileId, publishedFile.fileId] } },
  });
  for (const f of made) await rm(f, { force: true });

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
