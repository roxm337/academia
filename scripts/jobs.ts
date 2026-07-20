import "dotenv/config";

import { prisma } from "../lib/prisma";
import { JOBS, runDaily, type JobName, type JobResult } from "../lib/jobs";

/**
 * Scheduled jobs, run from system cron on the VPS.
 *
 * `--conditions=react-server` is required: the data layer imports `server-only`,
 * which throws outside that condition. Without it the job dies before it starts.
 *
 *   npx tsx --conditions=react-server scripts/jobs.ts daily              # daily set
 *   npx tsx --conditions=react-server scripts/jobs.ts payment-reminders  # one job
 *   npx tsx --conditions=react-server scripts/jobs.ts daily --dry-run    # no e-mail
 *
 * Suggested crontab (07:00 every day, logging where you can find it):
 *
 *   0 7 * * * cd /srv/planete-montessori && /usr/bin/npx tsx --conditions=react-server \
 *     scripts/jobs.ts daily >> /var/log/planete-montessori-jobs.log 2>&1
 *
 * Exits non-zero if any job reported an error, so cron's own mail — or your
 * monitoring — surfaces a silent failure instead of it going unnoticed.
 */

const USAGE = `usage: tsx scripts/jobs.ts <daily|${Object.keys(JOBS).join("|")}> [--dry-run]`;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const name = args.find((a) => !a.startsWith("--"));

  if (!name) {
    console.error(USAGE);
    process.exit(2);
  }
  if (name !== "daily" && !(name in JOBS)) {
    console.error(`unknown job "${name}"\n${USAGE}`);
    process.exit(2);
  }

  if (dryRun) {
    // Nothing here writes through a queue we could intercept, so a dry run
    // reports what the run WOULD cover rather than pretending to send.
    process.env.SMTP_HOST = "";
    console.log("[jobs] dry run: e-mail disabled, in-app rows still written");
  }

  const startedAt = Date.now();
  const stamp = new Date().toISOString();
  console.log(`[jobs] ${stamp} starting "${name}"`);

  const results: JobResult[] =
    name === "daily" ? await runDaily() : [await JOBS[name as JobName]()];

  let failed = false;
  for (const r of results) {
    console.log(
      `[jobs]   ${r.job}: processed=${r.processed} notified=${r.notified} errors=${r.errors.length}`,
    );
    for (const err of r.errors) {
      failed = true;
      console.error(`[jobs]     ! ${err}`);
    }
  }

  console.log(`[jobs] done in ${Date.now() - startedAt}ms`);
  await prisma.$disconnect();
  // The pooled SMTP transport can hold the event loop open.
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error("[jobs] fatal:", e);
  await prisma.$disconnect();
  process.exit(1);
});
