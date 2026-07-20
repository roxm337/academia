/**
 * Pure e-learning rules — no Prisma, no server-only, so both the server
 * actions and the tests use the exact same logic.
 *
 * The visibility rule in particular is an authorization rule: it decides which
 * units a student may read. It lived inline in three separate queries before,
 * which is three chances to drift. One definition, one test table.
 */

export type UnitScope = {
  levelId: string;
  /** null = the unit targets the whole level, every stream in it. */
  streamId: string | null;
};

export type ClassScope = {
  levelId: string;
  /** null for cycles that have no streams (primaire, collège). */
  streamId: string | null;
};

/**
 * May a student in `klass` see `unit`?
 *
 * Same level always required. A unit with no stream is level-wide — collège
 * has no streams at all, and a lycée teacher may deliberately publish to every
 * stream at a level. A unit WITH a stream is only for that stream.
 */
export function unitVisibleTo(unit: UnitScope, klass: ClassScope): boolean {
  if (unit.levelId !== klass.levelId) return false;
  if (unit.streamId === null) return true;
  return unit.streamId === klass.streamId;
}

export type Assignment = {
  levelId: string;
  streamId: string | null;
};

/**
 * May a teacher author a unit at this curriculum coordinate?
 *
 * Only if they actually teach a class there. Both sides normalize "" and
 * undefined (which is what an empty <select> submits) to null before
 * comparing, so a missing stream can never accidentally equal a real one.
 */
export function canAuthorAt(
  assignments: Assignment[],
  target: { levelId: string; streamId: string | null | undefined },
): boolean {
  const stream = normalizeStream(target.streamId);
  return assignments.some(
    (a) => a.levelId === target.levelId && normalizeStream(a.streamId) === stream,
  );
}

/** "" and undefined both mean "no stream". Keep one representation: null. */
export function normalizeStream(streamId: string | null | undefined): string | null {
  return streamId ? streamId : null;
}

/**
 * Next position in a unit. Lessons are 0-indexed, so the first one in an empty
 * unit is 0 — not 1, which would leave a permanent gap at the front.
 */
export function nextOrder(maxOrder: number | null | undefined): number {
  return (maxOrder ?? -1) + 1;
}

/**
 * Dedup key for a teacher's curriculum options.
 *
 * JSON rather than string concatenation: a `:`-joined key with an "all"
 * sentinel would collide if a stream were ever literally id'd "all", and cuid
 * ids make that unlikely but not impossible.
 */
export function curriculumKey(
  levelId: string,
  streamId: string | null | undefined,
  subjectId: string,
): string {
  return JSON.stringify([levelId, normalizeStream(streamId), subjectId]);
}
