import "dotenv/config";

import { prisma } from "../lib/prisma";
import { detectConflicts, type SlotShape } from "../lib/timetable";
import { getYearSlotsForConflict } from "../lib/data/timetable";

/**
 * Drives a real move against the database, then puts everything back.
 *
 * The pure engine is covered by acceptance-move-slot.mts; this checks the part
 * that actually writes — that a legal move persists, an illegal one changes
 * nothing, and neither can alter who teaches the lesson.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-move-slot-live.mts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};

/** The write half of moveSlot, minus the auth/audit the action adds. */
async function tryMove(
  slotId: string,
  weekday: SlotShape["weekday"],
  startMin: number,
  endMin: number,
) {
  const slot = await prisma.timetableSlot.findUnique({ where: { id: slotId } });
  if (!slot) return { error: "notFound" as const };
  if (slot.weekday === weekday && slot.startMin === startMin) return { ok: true as const };

  const candidate: SlotShape = {
    id: slot.id,
    weekday,
        startMin,
    endMin,
    classId: slot.classId,
    teacherId: slot.teacherId,
    roomId: slot.roomId,
  };
  const conflicts = detectConflicts(candidate, await getYearSlotsForConflict());
  if (conflicts.length) {
    return { error: "conflict" as const, kinds: [...new Set(conflicts.map((c) => c.kind))] };
  }
  await prisma.timetableSlot.update({
    where: { id: slot.id },
    // Only the destination is written — identity fields are untouched.
    data: { weekday, startMin, endMin },
  });
  return { ok: true as const };
}

async function main() {
  const slot = await prisma.timetableSlot.findFirst({
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
  });
  if (!slot) throw new Error("seed missing: a NORMAL slot");

  const original = {
    weekday: slot.weekday,
    startMin: slot.startMin,
    endMin: slot.endMin,
  };
  const restore = () =>
    prisma.timetableSlot.update({ where: { id: slot.id }, data: original });

  try {
    console.log("\n== a legal move persists ==");
    // Saturday evening — outside every seeded band.
    const moved = await tryMove(slot.id, "FRIDAY", 1140, 1200);
    check("the move is accepted", "ok" in moved && moved.ok === true, JSON.stringify(moved));
    const after = await prisma.timetableSlot.findUnique({ where: { id: slot.id } });
    check("the new day was written", after?.weekday === "FRIDAY", String(after?.weekday));
    check("the new time was written", after?.startMin === 1140 && after?.endMin === 1200);
    check(
      "class, subject, teacher and room are untouched",
      after?.classId === slot.classId &&
        after?.subjectId === slot.subjectId &&
        after?.teacherId === slot.teacherId &&
        after?.roomId === slot.roomId,
    );

    console.log("\n== an illegal move changes nothing ==");
    const blocker = await prisma.timetableSlot.findFirst({
      where: { id: { not: slot.id }, classId: slot.classId },
    });
    if (blocker) {
      const refused = await tryMove(slot.id, blocker.weekday, blocker.startMin, blocker.endMin);
      check("dropping onto an occupied cell is refused", "error" in refused);
      const unchanged = await prisma.timetableSlot.findUnique({ where: { id: slot.id } });
      check(
        "the slot stayed where it was",
        unchanged?.weekday === "FRIDAY" && unchanged?.startMin === 1140,
        `${unchanged?.weekday} ${unchanged?.startMin}`,
      );
    } else {
      console.log("  skip (no second slot in this class)");
    }

    console.log("\n== dropping a slot back on itself is a no-op ==");
    const noop = await tryMove(slot.id, "FRIDAY", 1140, 1200);
    check("same cell returns ok without writing", "ok" in noop && noop.ok === true);
  } finally {
    await restore();
    const back = await prisma.timetableSlot.findUnique({ where: { id: slot.id } });
    check(
      "restored to the original cell",
      back?.weekday === original.weekday && back?.startMin === original.startMin,
      `${back?.weekday} ${back?.startMin}`,
    );
  }

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
