import "server-only";

import { prisma } from "@/lib/prisma";
import { computeClassResults } from "@/lib/data/grades";
import { buildSnapshot, type SubjectLine } from "@/lib/council";
import type { Mention } from "@/lib/generated/prisma/enums";

/**
 * Writing the conseil-de-classe archive.
 *
 * Deliberately NOT a "use server" module: the server actions call in here, but
 * so do the acceptance scripts, and a file marked "use server" drags the Next
 * router runtime in with it and cannot be imported outside a request.
 */

/**
 * Recomputes every student's snapshot for a class and stores it.
 *
 * Safe to run repeatedly while the council is sitting — it overwrites the
 * figures but never the council's own words, so a re-run after a late grade
 * correction does not wipe decisions already recorded in the meeting.
 */
export async function snapshotClass(classId: string, semesterId: string): Promise<number> {
  const { students, stats } = await computeClassResults(classId, semesterId);
  const classSize = students.length;

  const appreciations = await prisma.subjectAppreciation.findMany({
    where: { classId, semesterId },
    select: { studentId: true, subjectId: true, text: true },
  });
  const apprByStudent = new Map<string, Map<string, string>>();
  for (const a of appreciations) {
    const forStudent = apprByStudent.get(a.studentId) ?? new Map<string, string>();
    forStudent.set(a.subjectId, a.text);
    apprByStudent.set(a.studentId, forStudent);
  }

  for (const s of students) {
    const subjects: SubjectLine[] = s.subjects.map((sub) => ({
      subjectId: sub.subjectId,
      code: sub.code,
      nameAr: sub.nameAr,
      nameFr: sub.nameFr,
      coefficient: sub.coefficient,
      average: sub.average,
      appreciation: apprByStudent.get(s.studentId)?.get(sub.subjectId) ?? null,
    }));

    const snap = buildSnapshot({
      general: s.general,
      rank: s.rank,
      mention: s.mention,
      subjects,
      classSize,
      stats,
    });

    const figures = {
      classId,
      generalAverage: snap.generalAverage,
      rank: snap.rank,
      classSize: snap.classSize,
      classAverage: snap.classAverage,
      classMin: snap.classMin,
      classMax: snap.classMax,
      mention: (snap.mention as Mention | null) ?? null,
      subjectBreakdown: snap.subjectBreakdown,
      computedAt: new Date(),
    };

    await prisma.semesterResult.upsert({
      where: { studentId_semesterId: { studentId: s.studentId, semesterId } },
      // Only the computed figures are refreshed; councilDecision and
      // directorAppreciation are deliberately absent from the update.
      update: figures,
      create: { studentId: s.studentId, semesterId, ...figures },
    });
  }

  return students.length;
}

/**
 * Archives every class for a semester and marks the results final.
 *
 * Called when the director locks the semester: locking is the single gesture
 * that closes it, so there is no state where a semester is closed but its
 * bulletins are still being recomputed from live data.
 */
export async function finalizeSemester(semesterId: string): Promise<number> {
  const classes = await prisma.class.findMany({
    where: { enrollments: { some: { isActive: true } } },
    select: { id: true },
  });

  let total = 0;
  for (const klass of classes) {
    total += await snapshotClass(klass.id, semesterId);
  }

  await prisma.semesterResult.updateMany({
    where: { semesterId },
    data: { isFinal: true },
  });
  return total;
}

/**
 * Reopens a semester's results for editing. Keeps every row — the council's
 * decisions and the director's comments survive an unlock, because losing them
 * would mean re-running the meeting.
 */
export async function unfinalizeSemester(semesterId: string): Promise<void> {
  await prisma.semesterResult.updateMany({
    where: { semesterId },
    data: { isFinal: false },
  });
}
