/**
 * Timetable domain logic — pure and client-safe (no DB, no server-only imports),
 * so the builder UI, the Server Action and the unit tests all share ONE
 * definition of "do these two lessons clash?".
 *
 * Times are stored as minutes-from-midnight (Int), not DateTime: a lesson is a
 * weekly recurring band, it has no date, and integer comparison is both simpler
 * and safer than juggling timezones. 08:00 -> 480, 13:30 -> 810.
 */

// Prisma enums are plain string unions at runtime; re-declaring the two we need
// keeps this file free of any server-only import so it can ship to the browser.
export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

/**
 * The French school week runs Monday–Friday. Wednesday is commonly a half day
 * in élémentaire, which is a matter of how few slots get placed rather than a
 * missing column, so it stays in the grid.
 */
export const WEEKDAYS: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

export type Period = { startMin: number; endMin: number };

/**
 * Row template for the weekly grid. A slot is drawn in the row whose band
 * contains its start; conflict detection (below) guarantees at most one lesson
 * per class in any band, so a cell never has to stack two blocks.
 */
export const PERIODS: Period[] = [
  { startMin: 8 * 60, endMin: 9 * 60 }, // 08:00–09:00
  { startMin: 9 * 60, endMin: 10 * 60 },
  { startMin: 10 * 60, endMin: 11 * 60 },
  { startMin: 11 * 60, endMin: 12 * 60 },
  { startMin: 12 * 60, endMin: 13 * 60 },
  { startMin: 14 * 60, endMin: 15 * 60 }, // afternoon after lunch
  { startMin: 15 * 60, endMin: 16 * 60 },
  { startMin: 16 * 60, endMin: 17 * 60 },
  { startMin: 17 * 60, endMin: 18 * 60 },
];


/** "08:00" <- 480. Always zero-padded, 24-hour. */
export function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 480 <- "08:00". Returns null on anything that isn't HH:MM in range. */
export function labelToMin(label: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Half-open overlap: [aStart,aEnd) ∩ [bStart,bEnd). Touching edges don't clash. */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** The band a lesson belongs to, or null if it starts outside every period. */
export function periodIndexFor(
  startMin: number,
  periods: Period[],
): number | null {
  const i = periods.findIndex(
    (p) => startMin >= p.startMin && startMin < p.endMin,
  );
  return i === -1 ? null : i;
}

// ---------------------------------------------------------------- conflicts

export type SlotShape = {
  id?: string;
  weekday: Weekday;
  startMin: number;
  endMin: number;
  classId: string;
  teacherId: string;
  roomId?: string | null;
};

export type ConflictKind = "class" | "teacher" | "room";

export type Conflict = {
  kind: ConflictKind;
  /** the id of the existing slot we clash with */
  slotId?: string;
};

/**
 * Everything wrong with placing `candidate`, checked against `existing`.
 *
 * A clash needs the same weekday AND overlapping times, plus one of:
 *   - class:   this class is already in a lesson then (can't be in two rooms)
 *   - teacher: this teacher is already teaching then
 *   - room:    this room is already occupied then
 *
 * A slot never conflicts with itself (matched by id), so editing a lesson in
 * place is not blocked by its own former position.
 */
export function detectConflicts(
  candidate: SlotShape,
  existing: SlotShape[],
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const other of existing) {
    if (candidate.id && other.id === candidate.id) continue;
    if (other.weekday !== candidate.weekday) continue;
    if (
      !rangesOverlap(
        candidate.startMin,
        candidate.endMin,
        other.startMin,
        other.endMin,
      )
    ) {
      continue;
    }

    if (other.classId === candidate.classId) {
      conflicts.push({ kind: "class", slotId: other.id });
    }
    if (other.teacherId === candidate.teacherId) {
      conflicts.push({ kind: "teacher", slotId: other.id });
    }
    if (
      candidate.roomId &&
      other.roomId &&
      other.roomId === candidate.roomId
    ) {
      conflicts.push({ kind: "room", slotId: other.id });
    }
  }

  return conflicts;
}
