import "dotenv/config";

import { prisma } from "../lib/prisma";
import { setUserLocale } from "../lib/preferences";
import { locales } from "../i18n/routing";

/**
 * Acceptance — the language preference is real.
 *
 * The gap this covers: the UI shipped in three languages while `User.locale`
 * was hardcoded at every creation site, so English existed on screen but never
 * in the database — and notification e-mail, which reads that column hours
 * later, could never be English.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-locale.ts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) {
    console.log(`  ok   ${name}`);
    pass++;
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
};

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "parent1@planetemontessori.demo" },
    select: { id: true, locale: true },
  });
  if (!user) throw new Error("seed must contain parent1@planetemontessori.demo");
  const original = user.locale;

  const read = async () =>
    (await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { locale: true },
    })).locale;

  console.log("\n== every served locale can be stored ==");
  for (const l of locales) {
    const returned = await setUserLocale(user.id, l);
    const stored = await read();
    check(`"${l}" persists`, returned === l && stored === l, `stored ${stored}`);
  }

  console.log("\n== English is reachable, which was the whole point ==");
  await setUserLocale(user.id, "en");
  check("a user row can hold en", (await read()) === "en");

  console.log("\n== junk never reaches the column ==");
  for (const bad of ["es", "EN", "fr-MA", "../../etc/passwd", ""]) {
    const returned = await setUserLocale(user.id, bad);
    const stored = await read();
    check(
      `"${bad}" falls back to fr instead of being written`,
      returned === "fr" && stored === "fr",
      `stored ${stored}`,
    );
  }

  // Leave the seed as we found it — this runs against the demo database.
  await prisma.user.update({ where: { id: user.id }, data: { locale: original } });
  check("restored the fixture's original locale", (await read()) === original);

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
