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
  /** null = the unit targets the whole level, whatever each student chose. */
  specialityId: string | null;
};

/**
 * What a student brings to the question "may I read this?".
 *
 * Their spécialités, not their class: since the 2019 reform a class is no
 * longer "1re S", so two students sitting side by side follow different
 * subjects. A unit for the NSI spécialité is for the students who took NSI,
 * not for the room they happen to sit in.
 */
export type LearnerScope = {
  levelId: string;
  /** Empty below Première, where there are no spécialités to choose. */
  specialityIds: string[];
};

/**
 * May a student see `unit`?
 *
 * Same level always required. A unit with no spécialité is level-wide — the
 * tronc commun, and everything below Première. A unit WITH one is only for the
 * students who chose it.
 */
export function unitVisibleTo(unit: UnitScope, learner: LearnerScope): boolean {
  if (unit.levelId !== learner.levelId) return false;
  if (unit.specialityId === null) return true;
  return learner.specialityIds.includes(unit.specialityId);
}

export type Assignment = {
  levelId: string;
};

/**
 * May a teacher author a unit at this curriculum coordinate?
 *
 * Only if they actually teach a class at that level. The spécialité is not
 * checked here: a teacher assigned to Terminale may write for the tronc commun
 * or for any spécialité offered there, and whether the spécialité really
 * belongs to that level is a database fact the caller verifies — this module
 * has no way to know it.
 */
export function canAuthorAt(
  assignments: Assignment[],
  target: { levelId: string },
): boolean {
  return assignments.some((a) => a.levelId === target.levelId);
}

/** "" and undefined both mean "no spécialité". Keep one representation: null. */
export function normalizeSpeciality(
  specialityId: string | null | undefined,
): string | null {
  return specialityId ? specialityId : null;
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
 * sentinel would collide if a spécialité were ever literally id'd "all", and
 * cuid ids make that unlikely but not impossible.
 */
export function curriculumKey(
  levelId: string,
  specialityId: string | null | undefined,
  subjectId: string,
): string {
  return JSON.stringify([levelId, normalizeSpeciality(specialityId), subjectId]);
}
