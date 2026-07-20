/**
 * Conseil de classe — the end-of-semester class council.
 *
 * Two jobs live here, both pure:
 *
 *  - the council's controlled vocabulary of decisions, stored as stable keys so
 *    the bulletin can render them in Arabic or French rather than replaying
 *    whatever language the director happened to type;
 *  - freezing a live computation into the snapshot that gets archived.
 *
 * Freezing is the point of the whole feature. A bulletin issued in February
 * must still show February's numbers when it is reprinted in July, even if a
 * student later changes class, a coefficient is corrected, or a classmate
 * leaves and everyone's rank would shift.
 */

export const COUNCIL_DECISIONS = [
  "FELICITATIONS",
  "ENCOURAGEMENTS",
  "TABLEAU_HONNEUR",
  "AVERTISSEMENT_TRAVAIL",
  "AVERTISSEMENT_CONDUITE",
  "BLAME_TRAVAIL",
] as const;

export type CouncilDecision = (typeof COUNCIL_DECISIONS)[number];

export function isCouncilDecision(value: string): value is CouncilDecision {
  return (COUNCIL_DECISIONS as readonly string[]).includes(value);
}

/**
 * What the council would normally award at this average — a starting point the
 * director can always override, never an automatic verdict. Thresholds follow
 * the same /20 bands as the bulletin mentions.
 */
export function suggestDecision(average: number | null): CouncilDecision | null {
  if (average === null) return null;
  if (average >= 16) return "FELICITATIONS";
  if (average >= 14) return "ENCOURAGEMENTS";
  if (average >= 12) return "TABLEAU_HONNEUR";
  if (average < 10) return "AVERTISSEMENT_TRAVAIL";
  return null;
}

export type SubjectLine = {
  subjectId: string;
  code: string;
  nameAr: string;
  nameFr: string;
  coefficient: number;
  average: number | null;
  /** The subject teacher's comment, as it stood when the semester was frozen. */
  appreciation?: string | null;
};

/** Exactly what gets written to SemesterResult.subjectBreakdown. */
export type FrozenBreakdown = {
  version: 1;
  subjects: SubjectLine[];
};

export type Snapshot = {
  generalAverage: number | null;
  rank: number | null;
  classSize: number;
  classAverage: number | null;
  classMin: number | null;
  classMax: number | null;
  mention: string | null;
  subjectBreakdown: FrozenBreakdown;
};

/**
 * Turns one student's live result into the archived snapshot.
 *
 * The per-subject lines are copied in full — coefficients included — because a
 * coefficient is a property of the year the mark was earned in. Reading it back
 * from the current LevelSubject table months later can silently restate a
 * finished semester.
 */
export function buildSnapshot(input: {
  general: number | null;
  rank: number | null;
  mention: string | null;
  subjects: SubjectLine[];
  classSize: number;
  stats: { average: number | null; min: number | null; max: number | null };
}): Snapshot {
  return {
    generalAverage: input.general,
    rank: input.rank,
    classSize: input.classSize,
    classAverage: input.stats.average,
    classMin: input.stats.min,
    classMax: input.stats.max,
    mention: input.mention,
    subjectBreakdown: {
      version: 1,
      subjects: input.subjects.map((s) => ({
        subjectId: s.subjectId,
        code: s.code,
        nameAr: s.nameAr,
        nameFr: s.nameFr,
        coefficient: s.coefficient,
        average: s.average,
        appreciation: s.appreciation ?? null,
      })),
    },
  };
}

/**
 * Reads a stored breakdown back, tolerating rows written before this shape
 * existed. An unrecognised payload yields no subjects rather than throwing —
 * a malformed archive must not make a bulletin un-printable.
 */
export function parseBreakdown(value: unknown): FrozenBreakdown {
  const empty: FrozenBreakdown = { version: 1, subjects: [] };
  if (!value || typeof value !== "object") return empty;
  const candidate = value as { version?: unknown; subjects?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.subjects)) return empty;
  return { version: 1, subjects: candidate.subjects as SubjectLine[] };
}
