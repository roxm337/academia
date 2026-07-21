import "dotenv/config";

import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.js";

/**
 * Acceptance — the school logo is public, and nothing else became public with it.
 *
 * The logo has to render on the login screen, which by definition has no
 * session, so /api/files grew its first anonymous path. The risk that buys is
 * obvious: if the exemption were a folder prefix, anyone could publish a file
 * by uploading it under the right name. It is keyed to the exact value stored
 * in SchoolSettings, and this proves it.
 *
 * Needs the app running (pnpm start). Run: npx tsx scripts/acceptance-brand.mts
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

const status = async (url: string) =>
  (await fetch(`${BASE}${url}`, { redirect: "manual" })).status;

async function main() {
  const root = process.env.STORAGE_LOCAL_DIR ?? "./storage";
  const made: string[] = [];
  const put = async (key: string) => {
    const full = path.join(root, key);
    await mkdir(path.dirname(full), { recursive: true });
    // A 1x1 PNG, so the response is a real image and not just bytes.
    await writeFile(
      full,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    );
    made.push(full);
    const row = await prisma.storedFile.create({
      data: { path: key, filename: "logo.png", mimeType: "image/png", size: 68 },
    });
    return row.id;
  };

  const logoKey = "brand/acceptance-logo.png";
  const decoyKey = "brand/acceptance-decoy.png";
  const logoId = await put(logoKey);
  const decoyId = await put(decoyKey);

  const settings = await prisma.schoolSettings.findUniqueOrThrow({
    where: { id: 1 },
    select: { logoPath: true },
  });
  const originalLogo = settings.logoPath;

  await prisma.schoolSettings.update({
    where: { id: 1 },
    data: { logoPath: `/api/files/${logoKey}` },
  });

  console.log("\n== the current logo is readable without logging in ==");
  check("anonymous GET of the logo succeeds", (await status(`/api/files/${logoKey}`)) === 200);

  console.log("\n== nothing else in the same folder is ==");
  check(
    "a sibling upload in brand/ is still refused",
    (await status(`/api/files/${decoyKey}`)) === 401,
    `got ${await status(`/api/files/${decoyKey}`)}`,
  );

  console.log("\n== the exemption follows the setting, not the file ==");
  await prisma.schoolSettings.update({
    where: { id: 1 },
    data: { logoPath: `/api/files/${decoyKey}` },
  });
  check("the old logo goes private once it is replaced", (await status(`/api/files/${logoKey}`)) === 401);
  check("the new logo becomes public", (await status(`/api/files/${decoyKey}`)) === 200);

  console.log("\n== the pages render the configured logo, not a hardcoded file ==");
  await prisma.schoolSettings.update({ where: { id: 1 }, data: { logoPath: originalLogo } });

  // The landing page is dynamic, so it reflects the database on every request.
  const landing = await (await fetch(`${BASE}/fr`)).text();
  check(
    "landing serves the logo stored in SchoolSettings",
    Boolean(originalLogo) && landing.includes(encodeURIComponent(originalLogo!)),
    `expected ${originalLogo}`,
  );

  // The login page is prerendered (● in the build output), so it holds whatever
  // the database said at build time — refreshed by the revalidatePath("/",
  // "layout") that updateSettings issues, not by a direct write like this one.
  const login = await (await fetch(`${BASE}/fr/login`)).text();
  check(
    "login serves the logo stored in SchoolSettings",
    Boolean(originalLogo) && login.includes(encodeURIComponent(originalLogo!)),
    `expected ${originalLogo}`,
  );

  // cleanup
  await prisma.storedFile.deleteMany({ where: { id: { in: [logoId, decoyId] } } });
  for (const f of made) await rm(f, { force: true });
  check("restored the school's real logo", true);

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
