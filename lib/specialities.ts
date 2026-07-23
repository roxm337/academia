/**
 * Rules for enseignements de spécialité — pure, client-safe, so the picker, the
 * server action, and the tests all agree on what a valid choice is.
 *
 * Since the 2019 reform the shape is fixed: a student picks THREE spécialités
 * in Première, and keeps TWO of them in Terminale. Nowhere else does a level
 * carry spécialités, so every other level has a required count of zero and no
 * picker is shown.
 */

/** How many spécialités a student at this level must hold. 0 = not applicable. */
export function requiredSpecialityCount(levelCode: string): number {
  if (levelCode === "1RE") return 3;
  if (levelCode === "TLE") return 2;
  return 0;
}

/** Whether this level chooses spécialités at all. */
export function specialitiesApply(levelCode: string): boolean {
  return requiredSpecialityCount(levelCode) > 0;
}

export type SpecialityChoiceError =
  | "notApplicable" // the level does not have spécialités
  | "wrongCount" // not exactly the number the level requires
  | "notOffered" // an id that is not offered at this level
  | "duplicate"; // the same spécialité chosen twice

/**
 * Is this set of chosen ids a valid choice for the level?
 *
 * An empty set is deliberately allowed as "clear the choice" — a director may
 * need to unset a student entered by mistake. A non-empty set must be exactly
 * the required count, with no duplicates, and every id must be one actually
 * offered at the level: the count and the offered-set are both checked here so
 * a crafted form cannot save two Terminale spécialités that belong to another
 * school, or three when only two are kept.
 */
export function validateSpecialityChoice(opts: {
  levelCode: string;
  chosen: string[];
  offeredIds: readonly string[];
}): { ok: true } | { ok: false; error: SpecialityChoiceError } {
  const need = requiredSpecialityCount(opts.levelCode);
  if (need === 0) return { ok: false, error: "notApplicable" };

  // Clearing is always valid.
  if (opts.chosen.length === 0) return { ok: true };

  if (new Set(opts.chosen).size !== opts.chosen.length) {
    return { ok: false, error: "duplicate" };
  }
  if (opts.chosen.length !== need) return { ok: false, error: "wrongCount" };

  const offered = new Set(opts.offeredIds);
  if (!opts.chosen.every((id) => offered.has(id))) {
    return { ok: false, error: "notOffered" };
  }
  return { ok: true };
}
