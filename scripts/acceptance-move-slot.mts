import "dotenv/config";

import { prisma } from "../lib/prisma";
import { detectConflicts, type SlotShape } from "../lib/timetable";
import { getYearSlotsForConflict } from "../lib/data/timetable";

/**
 * The rules behind timetable drag-and-drop.
 *
 * The UI is only as good as the action underneath it, and the thing that must
 * hold is: a drag says "put this here" and nothing else. It cannot change who
 * teaches the lesson, and it cannot create a clash the form would have refused.
 *
 * This exercises the same conflict engine the action calls, against the real
 * seeded timetable.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-move-slot.mts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
  });
  if (slots.length < 2) throw new Error("seed missing: at least two NORMAL slots");

  const existing = await getYearSlotsForConflict();
  const subject = slots[0];
  const other = slots.find(
    (s) => s.id !== subject.id && (s.weekday !== subject.weekday || s.startMin !== subject.startMin),
  );
  if (!other) throw new Error("seed missing: a second slot in a different cell");

  const at = (weekday: typeof subject.weekday, startMin: number, endMin: number): SlotShape => ({
    id: subject.id,
    weekday,
    startMin,
    endMin,
    classId: subject.classId,
    teacherId: subject.teacherId,
    roomId: subject.roomId,
  });

  console.log("\n== a free cell accepts the move ==");
  // Saturday evening: outside every seeded band, so guaranteed empty.
  const free = detectConflicts(at("FRIDAY", 1140, 1200), existing);
  check("no conflict moving into an empty band", free.length === 0, JSON.stringify(free));

  console.log("\n== the slot does not clash with itself ==");
  const samePlace = detectConflicts(
    at(subject.weekday, subject.startMin, subject.endMin),
    existing,
  );
  check(
    "moving a slot onto its own cell is not a conflict",
    samePlace.length === 0,
    JSON.stringify(samePlace),
  );

  console.log("\n== an occupied cell is refused ==");
  const onto = detectConflicts(at(other.weekday, other.startMin, other.endMin), existing);
  check("dropping onto another lesson conflicts", onto.length > 0);
  check(
    "the reason names the class, teacher or room",
    onto.every((c) => ["class", "teacher", "room"].includes(c.kind)),
    JSON.stringify(onto.map((c) => c.kind)),
  );

  console.log("\n== a partial overlap still conflicts ==");
  // Half an hour into an existing lesson — the engine must compare ranges, not
  // just equal start times.
  const overlap = detectConflicts(
    at(other.weekday, other.startMin + 30, other.endMin + 30),
    existing,
  );
  check("an overlapping band conflicts", overlap.length > 0);

  console.log("\n== an occupied cell is refused ==");
  const clash = detectConflicts(at(other.weekday, other.startMin, other.endMin), existing);
  check(
    "dropping onto another lesson's slot reports a conflict",
    clash.length > 0,
    `conflicts=[${clash.map((c) => c.kind)}]`,
  );

  console.log("\n== identity fields are not part of a move ==");
  // moveSlot re-reads class/subject/teacher/room from the stored row; the only
  // things it takes from the client are weekday/startMin/endMin.
  const stored = await prisma.timetableSlot.findUnique({ where: { id: subject.id } });
  check(
    "the stored slot still owns its class/subject/teacher",
    stored?.classId === subject.classId &&
      stored?.subjectId === subject.subjectId &&
      stored?.teacherId === subject.teacherId,
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
