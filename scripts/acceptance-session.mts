#!/usr/bin/env -S npx tsx
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.js";

/**
 * A signed-in session must stop working the moment the account does.
 *
 * The JWT lives for 8 hours and carries the user's id and role. Trusting it
 * without re-reading the row meant a deleted account kept working (and every
 * write it attempted violated a foreign key), a deactivated account kept its
 * access, and a role change didn't take effect until the token expired.
 *
 * This drives a real browser-style session over HTTP: log in, then change the
 * account underneath the cookie and check the session dies.
 *
 * Needs the app running (npm run dev or npm start).
 * Run: npx tsx scripts/acceptance-session.mts
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
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

const status = async (path: string, cookie: string) =>
  (await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" })).status;

async function main() {
  const email = "eleve1@planetemontessori.demo";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`seed missing: ${email}`);

  const cookie = await login(email);
  console.log("\n== a live account works ==");
  check("the student's dashboard loads", (await status("/fr/student", cookie)) === 200);

  try {
    console.log("\n== deactivating the account kills the live session ==");
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const afterDeactivate = await status("/fr/student", cookie);
    check(
      "the same cookie is now redirected to login",
      afterDeactivate === 307,
      `got ${afterDeactivate}`,
    );

    await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
    check("reactivating restores access", (await status("/fr/student", cookie)) === 200);

    console.log("\n== a role change takes effect immediately ==");
    // The token still says STUDENT; the database is the authority.
    await prisma.user.update({ where: { id: user.id }, data: { role: "TEACHER" } });
    const asTeacher = await status("/fr/teacher", cookie);
    const asStudent = await status("/fr/student", cookie);
    check("the promoted role can reach its own area", asTeacher === 200, `got ${asTeacher}`);
    check(
      "and is bounced from the old one",
      asStudent === 307,
      `got ${asStudent} — the JWT still claims STUDENT`,
    );
  } finally {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: user.role, isActive: user.isActive },
    });
  }

  console.log("\n== a session for a deleted account cannot write ==");
  // The exact shape that produced the P2003 foreign-key crash: a valid-looking
  // cookie whose user row no longer exists.
  const ghost = await prisma.user.create({
    data: {
      email: `ghost-${Date.now()}@acceptance.test`,
      passwordHash: user.passwordHash,
      role: "STUDENT",
      firstNameAr: "شبح",
      lastNameAr: "اختبار",
      firstNameFr: "Ghost",
      lastNameFr: "Test",
    },
  });
  const ghostCookie = await login(ghost.email);
  check("the ghost can sign in while it exists", (await status("/fr/student", ghostCookie)) === 200);

  await prisma.user.delete({ where: { id: ghost.id } });
  const afterDelete = await status("/fr/student", ghostCookie);
  check(
    "once deleted, the session is refused rather than crashing",
    afterDelete === 307,
    `got ${afterDelete} (500 would mean the FK violation is back)`,
  );

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
