import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

const hwInclude = {
  subject: true,
  teacher: { include: { user: true } },
  attachments: { include: { file: true } },
} as const;

/** Homework for one class+subject (teacher view), with submission counts. */
export const teacherHomework = cache(
  async (classId: string, subjectId: string) =>
    prisma.homework.findMany({
      where: { classId, subjectId },
      include: {
        ...hwInclude,
        _count: { select: { submissions: true } },
      },
      orderBy: { dueAt: "desc" },
    }),
);

/** One homework with every submission (teacher review view). */
export const homeworkDetail = cache(async (homeworkId: string) =>
  prisma.homework.findUnique({
    where: { id: homeworkId },
    include: {
      ...hwInclude,
      submissions: {
        include: {
          student: {
            select: {
              id: true,
              user: {
                select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true },
              },
            },
          },
          attachments: { include: { file: true } },
        },
        orderBy: { submittedAt: "asc" },
      },
    },
  }),
);

/**
 * Published homework for a class, each with THIS student's submission (if any).
 * Used by the student's own page and the parent view of a child.
 */
export const homeworkForStudent = cache(
  async (classId: string, studentId: string) => {
    const rows = await prisma.homework.findMany({
      where: { classId, isPublished: true },
      include: {
        ...hwInclude,
        submissions: {
          where: { studentId },
          include: { attachments: { include: { file: true } } },
        },
      },
      orderBy: { dueAt: "desc" },
    });
    return rows.map((h) => ({ ...h, mySubmission: h.submissions[0] ?? null }));
  },
);
