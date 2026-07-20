import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { StudentStatus } from "@/lib/generated/prisma/enums";
import { currentYear } from "@/lib/data/structure";

export type StudentFilters = {
  q?: string;
  classId?: string;
  status?: StudentStatus | "";
};

/**
 * Director-facing student list: search by name or Code Massar.
 *
 * Capped, and the cap is **reported** — a school of 600 must not be shown the
 * first 100 rows labelled "100 students", which is what happened before. The
 * caller gets the total so it can say "100 of 626" and prompt for a search.
 */
export async function searchStudents(filters: StudentFilters, take = 100) {
  const year = await currentYear();
  const q = filters.q?.trim();

  const where: Prisma.StudentProfileWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.classId
      ? {
          enrollments: {
            some: { classId: filters.classId, isActive: true },
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { codeMassar: { contains: q, mode: "insensitive" } },
            { cne: { contains: q, mode: "insensitive" } },
            { user: { firstNameFr: { contains: q, mode: "insensitive" } } },
            { user: { lastNameFr: { contains: q, mode: "insensitive" } } },
            { user: { firstNameAr: { contains: q } } },
            { user: { lastNameAr: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, students] = await Promise.all([
    prisma.studentProfile.count({ where }),
    prisma.studentProfile.findMany({
    where,
    take,
    orderBy: { user: { lastNameFr: "asc" } },
    include: {
      user: true,
      enrollments: {
        where: { isActive: true, ...(year ? { class: { schoolYearId: year.id } } : {}) },
        include: { class: true },
      },
    },
    }),
  ]);

  return { students, total, truncated: total > students.length };
}

export const getStudent = cache(async (id: string) =>
  prisma.studentProfile.findUnique({
    where: { id },
    include: {
      user: true,
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        include: { class: { include: { level: true, stream: true } } },
      },
      guardians: { include: { guardian: { include: { user: true } } } },
      documents: { include: { file: true }, orderBy: { createdAt: "desc" } },
    },
  }),
);

/** The class a student is currently in, for the active year. */
export function activeClassOf(student: {
  enrollments: { isActive: boolean; class: { id: string; name: string } }[];
}) {
  return student.enrollments.find((e) => e.isActive)?.class ?? null;
}
