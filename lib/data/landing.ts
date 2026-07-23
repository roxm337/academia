import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Everything the public home page shows.
 *
 * This is the one read model with no session behind it, so the rule is
 * different from every other file in lib/data: only facts a school already
 * prints in its prospectus may appear here. Counts, cycles, levels,
 * spécialités, subject names, term dates. No names, no marks, no class rosters,
 * no announcements — those are audience-scoped and belong behind the login.
 *
 * One query per section, all in parallel, and the whole thing is memoised per
 * request: the landing page is the most-hit route in the app and the only one
 * an anonymous visitor can hammer.
 */
export const landingData = cache(async () => {
  const year = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, label: true, semesters: { orderBy: { index: "asc" } } },
  });

  const [cycles, specialities, subjectRows, students, teachers, classes, subjectCount] =
    await Promise.all([
      prisma.cycle.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true, kind: true, nameAr: true, nameFr: true,
          levels: { orderBy: { order: "asc" }, select: { id: true, code: true, nameAr: true, nameFr: true } },
        },
      }),
      // Offered in Première and Terminale; the same eight exist at both levels,
      // so they are deduplicated by code for display.
      prisma.speciality.findMany({
        where: { level: { code: "TLE" } },
        orderBy: { code: "asc" },
        select: { id: true, code: true, nameAr: true, nameFr: true },
      }),
      prisma.levelSubject.findMany({
        where: { specialityId: null },
        select: {
          coefficient: true,
          subject: { select: { id: true, code: true, nameAr: true, nameFr: true } },
          level: { select: { cycleId: true } },
        },
      }),
      prisma.studentProfile.count({ where: { status: "ACTIVE" } }),
      prisma.teacherProfile.count(),
      year ? prisma.class.count({ where: { schoolYearId: year.id } }) : Promise.resolve(0),
      prisma.subject.count(),
    ]);

  // Subjects grouped by cycle, deduplicated — a subject taught in both 6e and
  // 3e is one line in a prospectus, not two.
  const byCycle = new Map<string, Map<string, { id: string; code: string; nameAr: string; nameFr: string }>>();
  for (const row of subjectRows) {
    const key = row.level.cycleId;
    if (!byCycle.has(key)) byCycle.set(key, new Map());
    byCycle.get(key)!.set(row.subject.id, row.subject);
  }

  return {
    year,
    cycles: cycles.map((c) => ({
      ...c,
      subjects: [...(byCycle.get(c.id)?.values() ?? [])].sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
    })),
    specialities,
    counts: { students, teachers, classes, subjects: subjectCount },
  };
});
