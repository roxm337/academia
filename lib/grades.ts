/**
 * Grade calculation — pure, client-safe, and the single source of truth for
 * "what's this average?". The gradebook UI, the Server Action that freezes a
 * result, the bulletin PDF and the tests all call these so a number never
 * disagrees with itself.
 *
 * Moroccan rules:
 *  - grades are out of 20, with decimals;
 *  - a subject's average is the weighted mean of its graded items, each first
 *    normalized to /20 (a /40 exam counts on the same scale as a /20 test);
 *  - the general average is coefficient-weighted: Σ(subjectAvg × coef) / Σ(coef);
 *  - everything shows to 2 decimals;
 *  - mention bands: ≥16 très bien, ≥14 bien, ≥12 assez bien, ≥10 passable, else
 *    insuffisant.
 */

export type Mention =
  | "TRES_BIEN"
  | "BIEN"
  | "ASSEZ_BIEN"
  | "PASSABLE"
  | "INSUFFISANT";

/** Round to 2 decimals, the precision a bulletin prints. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Put a raw score on the /20 scale. A null (ungraded) stays null. */
export function normalizeTo20(
  score: number | null,
  maxScore: number,
): number | null {
  if (score === null) return null;
  if (maxScore <= 0) return null;
  return (score / maxScore) * 20;
}

export type GradeInput = {
  score: number | null; // null = not graded; excluded, not treated as zero
  maxScore: number; // the item is out of this (usually 20)
  weight: number; // relative weight of the item within the subject
};

/**
 * A subject's average: the weight-weighted mean of its graded items on the /20
 * scale. Ungraded items are skipped entirely — a blank is "not yet marked", not
 * a zero. Returns null when nothing is graded (so the subject drops out of the
 * general average rather than dragging it to 0).
 */
export function subjectAverage(items: GradeInput[]): number | null {
  let weighted = 0;
  let totalWeight = 0;
  for (const it of items) {
    const norm = normalizeTo20(it.score, it.maxScore);
    if (norm === null) continue;
    const w = it.weight > 0 ? it.weight : 0;
    if (w === 0) continue;
    weighted += norm * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return null;
  return round2(weighted / totalWeight);
}

export type SubjectResult = {
  average: number | null;
  coefficient: number;
};

/**
 * The general average: Σ(subjectAvg × coef) / Σ(coef), over subjects that
 * actually have an average. A subject with no grades contributes neither to the
 * numerator nor to the denominator.
 */
export function generalAverage(subjects: SubjectResult[]): number | null {
  let weighted = 0;
  let totalCoef = 0;
  for (const s of subjects) {
    if (s.average === null) continue;
    const c = s.coefficient > 0 ? s.coefficient : 0;
    if (c === 0) continue;
    weighted += s.average * c;
    totalCoef += c;
  }
  if (totalCoef === 0) return null;
  return round2(weighted / totalCoef);
}

/** Bulletin mention for a /20 average. Null average → null mention. */
export function mentionFor(average: number | null): Mention | null {
  if (average === null) return null;
  if (average >= 16) return "TRES_BIEN";
  if (average >= 14) return "BIEN";
  if (average >= 12) return "ASSEZ_BIEN";
  if (average >= 10) return "PASSABLE";
  return "INSUFFISANT";
}

export type Ranked<T> = T & { rank: number | null };

/**
 * Class ranking by general average, highest first, using standard competition
 * ranking: equal averages share a rank and the next rank skips (1, 2, 2, 4).
 * Students with no average are unranked (rank = null) and sort to the end —
 * you can't rank someone with no grades.
 *
 * Comparison is on the rounded 2-decimal average so two bulletins that both
 * print 13.50 are genuinely tied, not split by a 3rd-decimal ghost.
 */
export function rankByAverage<T extends { average: number | null }>(
  students: T[],
): Ranked<T>[] {
  const withIdx = students.map((s, i) => ({ s, i }));
  withIdx.sort((a, b) => {
    const aa = a.s.average;
    const bb = b.s.average;
    if (aa === null && bb === null) return a.i - b.i;
    if (aa === null) return 1;
    if (bb === null) return -1;
    if (bb !== aa) return bb - aa;
    return a.i - b.i; // stable for ties
  });

  const out: Ranked<T>[] = [];
  let lastAverage: number | null = null;
  let lastRank = 0;
  let seen = 0;
  for (const { s } of withIdx) {
    if (s.average === null) {
      out.push({ ...s, rank: null });
      continue;
    }
    seen++;
    if (lastAverage === null || s.average !== lastAverage) {
      lastRank = seen; // skip ranks for ties above
      lastAverage = s.average;
    }
    out.push({ ...s, rank: lastRank });
  }
  return out;
}

/** Simple class statistics over the graded averages (min / max / mean). */
export function classStats(averages: (number | null)[]): {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
} {
  const vals = averages.filter((a): a is number => a !== null);
  if (vals.length === 0) return { count: 0, average: null, min: null, max: null };
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    count: vals.length,
    average: round2(sum / vals.length),
    min: round2(Math.min(...vals)),
    max: round2(Math.max(...vals)),
  };
}
