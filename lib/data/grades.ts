import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { currentYear } from "@/lib/data/structure";
import {
  subjectAverage,
  generalAverage,
  mentionFor,
  rankByAverage,
  classStats,
  type Mention,
} from "@/lib/grades";

/**
 * The coefficient for each subject *as it applies to this class*. A class sits
 * in a level and (maybe) a stream; a coefficient may be set level-wide
 * (streamId null) or for a specific stream. The stream-specific value wins over
 * the level-wide fallback — that's the whole point of streams.
 */
export const classCoefficients = cache(async (classId: string) => {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { levelId: true, streamId: true },
  });
  if (!klass) return new Map<string, { coefficient: number; subject: SubjectLite }>();

  const rows = await prisma.levelSubject.findMany({
    where: {
      levelId: klass.levelId,
      OR: [{ streamId: klass.streamId }, { streamId: null }],
    },
    include: { subject: true },
  });

  const bySubject = new Map<string, { coefficient: number; subject: SubjectLite }>();
  for (const r of rows) {
    const existing = bySubject.get(r.subjectId);
    // Prefer the stream-specific row; only fall back to level-wide.
    const isStreamSpecific = r.streamId === klass.streamId && klass.streamId !== null;
    if (!existing || isStreamSpecific) {
      bySubject.set(r.subjectId, {
        coefficient: Number(r.coefficient),
        subject: r.subject,
      });
    }
  }
  return bySubject;
});

type SubjectLite = { id: string; code: string; nameAr: string; nameFr: string };

/** The two semesters of the active year. */
export const semestersOf = cache(async () => {
  const year = await currentYear();
  if (!year) return [];
  return prisma.semester.findMany({
    where: { schoolYearId: year.id },
    orderBy: { index: "asc" },
  });
});

export const semesterById = cache(async (id: string) =>
  prisma.semester.findUnique({ where: { id } }),
);

/** The (class, subject) pairs a teacher is assigned — what their gradebook offers. */
export const teacherClassSubjects = cache(async (userId: string) => {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      assignments: {
        include: {
          class: { select: { id: true, name: true } },
          subject: true,
        },
        orderBy: [{ class: { name: "asc" } }, { subject: { code: "asc" } }],
      },
    },
  });
  return profile;
});

/** The active roster (id + names) for a class, ordered by family name. */
export const gradeRoster = cache(async (classId: string) => {
  const rows = await prisma.enrollment.findMany({
    where: { classId, isActive: true },
    select: {
      student: {
        select: {
          id: true, codeMassar: true,
          user: {
            select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true },
          },
        },
      },
    },
  });
  return rows
    .map((r) => r.student)
    .sort((a, b) => a.user.lastNameFr.localeCompare(b.user.lastNameFr));
});

/** Grade items (contrôles/activités) for one class+subject+semester, with grades. */
export const gradeItemsFor = cache(
  async (classId: string, subjectId: string, semesterId: string) =>
    prisma.gradeItem.findMany({
      where: { classId, subjectId, semesterId },
      include: { grades: true },
      orderBy: [{ kind: "asc" }, { index: "asc" }],
    }),
);

/** The subject-appreciation text for each student in a class+subject+semester. */
export const appreciationsFor = cache(
  async (classId: string, subjectId: string, semesterId: string) => {
    const rows = await prisma.subjectAppreciation.findMany({
      where: { classId, subjectId, semesterId },
      select: { studentId: true, text: true },
    });
    return new Map(rows.map((r) => [r.studentId, r.text]));
  },
);

export type StudentSubjectResult = {
  subjectId: string;
  code: string;
  nameAr: string;
  nameFr: string;
  coefficient: number;
  average: number | null;
};

export type StudentResult = {
  studentId: string;
  codeMassar: string;
  firstNameAr: string;
  lastNameAr: string;
  firstNameFr: string;
  lastNameFr: string;
  subjects: StudentSubjectResult[];
  general: number | null;
  mention: Mention | null;
  rank: number | null;
};

/**
 * Every active student's full result for a class+semester: per-subject averages
 * (coefficient-weighted into a general average), mention and class rank, plus
 * class statistics. One pass over the class's grades feeds all of it — this is
 * what both the director overview and every bulletin read from.
 */
export const computeClassResults = cache(
  async (classId: string, semesterId: string) => {
    const [coefMap, items, roster] = await Promise.all([
      classCoefficients(classId),
      prisma.gradeItem.findMany({
        where: { classId, semesterId },
        include: { grades: { select: { studentId: true, score: true } } },
      }),
      prisma.enrollment.findMany({
        where: { classId, isActive: true },
        select: {
          student: {
            select: {
              id: true, codeMassar: true,
              user: {
                select: {
                  firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // score lookup: subjectId -> studentId -> [{score, maxScore, weight}]
    const gradesBySubjectStudent = new Map<
      string,
      Map<string, { score: number | null; maxScore: number; weight: number }[]>
    >();
    for (const item of items) {
      let bySubject = gradesBySubjectStudent.get(item.subjectId);
      if (!bySubject) {
        bySubject = new Map();
        gradesBySubjectStudent.set(item.subjectId, bySubject);
      }
      const maxScore = Number(item.maxScore);
      const weight = Number(item.weight);
      for (const g of item.grades) {
        const arr = bySubject.get(g.studentId) ?? [];
        arr.push({ score: g.score === null ? null : Number(g.score), maxScore, weight });
        bySubject.set(g.studentId, arr);
      }
    }

    const subjectsSorted = [...coefMap.entries()].sort((a, b) =>
      a[1].subject.code.localeCompare(b[1].subject.code),
    );

    const students = roster.map((e) => {
      const s = e.student;
      const subjects: StudentSubjectResult[] = subjectsSorted.map(([subjectId, { coefficient, subject }]) => {
        const grades = gradesBySubjectStudent.get(subjectId)?.get(s.id) ?? [];
        return {
          subjectId,
          code: subject.code,
          nameAr: subject.nameAr,
          nameFr: subject.nameFr,
          coefficient,
          average: subjectAverage(grades),
        };
      });
      const general = generalAverage(
        subjects.map((x) => ({ average: x.average, coefficient: x.coefficient })),
      );
      return {
        studentId: s.id,
        codeMassar: s.codeMassar,
        firstNameAr: s.user.firstNameAr,
        lastNameAr: s.user.lastNameAr,
        firstNameFr: s.user.firstNameFr,
        lastNameFr: s.user.lastNameFr,
        subjects,
        general,
        mention: mentionFor(general),
      };
    });

    // Rank on the general average, then carry the rank back onto each student.
    const rankById = new Map(
      rankByAverage(students.map((s) => ({ studentId: s.studentId, average: s.general }))).map(
        (r) => [r.studentId, r.rank],
      ),
    );
    const ranked: StudentResult[] = students.map((s) => ({
      ...s,
      rank: rankById.get(s.studentId) ?? null,
    }));
    const stats = classStats(ranked.map((r) => r.general));
    return { students: ranked, stats, subjects: subjectsSorted.map(([, v]) => v) };
  },
);

/** One student's result within their class+semester (for a bulletin / their own view). */
export const studentResult = cache(
  async (classId: string, studentId: string, semesterId: string) => {
    const { students, stats } = await computeClassResults(classId, semesterId);
    const me = students.find((s) => s.studentId === studentId) ?? null;
    return { result: me, stats, classSize: students.length };
  },
);
