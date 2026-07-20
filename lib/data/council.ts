import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { computeClassResults } from "@/lib/data/grades";
import { parseBreakdown, suggestDecision, type Snapshot } from "@/lib/council";

/**
 * Conseil de classe reads.
 *
 * While a semester is open the council works from the LIVE computation, so a
 * grade corrected an hour before the meeting is reflected. Once the semester is
 * finalised the frozen SemesterResult row becomes the source of truth, and the
 * live numbers are never consulted again.
 */

export type CouncilRow = {
  studentId: string;
  codeMassar: string;
  firstNameAr: string;
  lastNameAr: string;
  firstNameFr: string;
  lastNameFr: string;
  general: number | null;
  rank: number | null;
  mention: string | null;
  /** What the council would normally award — advisory only. */
  suggestion: string | null;
  decision: string | null;
  directorAppreciation: string | null;
  /** True once this student's row is archived. */
  frozen: boolean;
};

export const councilForClass = cache(async (classId: string, semesterId: string) => {
  const [live, stored, semester] = await Promise.all([
    computeClassResults(classId, semesterId),
    prisma.semesterResult.findMany({
      where: { classId, semesterId },
      select: {
        studentId: true,
        generalAverage: true,
        rank: true,
        mention: true,
        councilDecision: true,
        directorAppreciation: true,
        isFinal: true,
      },
    }),
    prisma.semester.findUnique({
      where: { id: semesterId },
      select: { id: true, index: true, isLocked: true, gradesPublishedAt: true },
    }),
  ]);

  const byStudent = new Map(stored.map((r) => [r.studentId, r]));
  const isFinal = stored.length > 0 && stored.every((r) => r.isFinal);

  const rows: CouncilRow[] = live.students.map((s) => {
    const archived = byStudent.get(s.studentId);
    // A finalised row wins; before that the live figures lead.
    const general = archived?.isFinal ? numberOrNull(archived.generalAverage) : s.general;
    const rank = archived?.isFinal ? archived.rank : s.rank;
    const mention = archived?.isFinal ? archived.mention : s.mention;
    return {
      studentId: s.studentId,
      codeMassar: s.codeMassar,
      firstNameAr: s.firstNameAr,
      lastNameAr: s.lastNameAr,
      firstNameFr: s.firstNameFr,
      lastNameFr: s.lastNameFr,
      general,
      rank,
      mention,
      suggestion: suggestDecision(general),
      decision: archived?.councilDecision ?? null,
      directorAppreciation: archived?.directorAppreciation ?? null,
      frozen: Boolean(archived?.isFinal),
    };
  });

  return {
    rows,
    stats: live.stats,
    classSize: live.students.length,
    semester,
    isFinal,
    archivedCount: stored.length,
  };
});

/**
 * A single student's archived result, or null if the semester was never
 * finalised for them. The bulletin prefers this over recomputing.
 */
export const frozenResult = cache(async (studentId: string, semesterId: string) => {
  const row = await prisma.semesterResult.findUnique({
    where: { studentId_semesterId: { studentId, semesterId } },
  });
  if (!row || !row.isFinal) return null;

  const snapshot: Snapshot = {
    generalAverage: numberOrNull(row.generalAverage),
    rank: row.rank,
    classSize: row.classSize ?? 0,
    classAverage: numberOrNull(row.classAverage),
    classMin: numberOrNull(row.classMin),
    classMax: numberOrNull(row.classMax),
    mention: row.mention,
    subjectBreakdown: parseBreakdown(row.subjectBreakdown),
  };
  return {
    snapshot,
    councilDecision: row.councilDecision,
    directorAppreciation: row.directorAppreciation,
    computedAt: row.computedAt,
  };
});

/** Prisma Decimal | null -> number | null, without turning null into 0. */
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}
