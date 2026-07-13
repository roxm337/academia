import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school";

/** The school year everything else hangs off. */
export const currentYear = cache(async () => {
  const settings = await getSchoolSettings();
  if (settings?.currentSchoolYear) return settings.currentSchoolYear;
  return prisma.schoolYear.findFirst({ where: { isCurrent: true } });
});

export const listCycles = cache(async () =>
  prisma.cycle.findMany({
    orderBy: { order: "asc" },
    include: {
      levels: {
        orderBy: { order: "asc" },
        include: { streams: { orderBy: { code: "asc" } } },
      },
    },
  }),
);

export const listLevels = cache(async () =>
  prisma.level.findMany({
    orderBy: { order: "asc" },
    include: { cycle: true, streams: { orderBy: { code: "asc" } } },
  }),
);

export const listRooms = cache(async () =>
  prisma.room.findMany({ orderBy: { name: "asc" } }),
);

export const listSubjects = cache(async () =>
  prisma.subject.findMany({ orderBy: { code: "asc" } }),
);

/** Classes for the active year, with enrolment counts. */
export const listClasses = cache(async () => {
  const year = await currentYear();
  if (!year) return [];

  return prisma.class.findMany({
    where: { schoolYearId: year.id },
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
    include: {
      level: { include: { cycle: true } },
      stream: true,
      mainTeacher: { include: { user: true } },
      _count: { select: { enrollments: { where: { isActive: true } } } },
    },
  });
});

/** Coefficients for one level (optionally narrowed to a stream). */
export const coefficientsFor = cache(
  async (levelId: string, streamId: string | null) =>
    prisma.levelSubject.findMany({
      where: { levelId, streamId },
      include: { subject: true },
      orderBy: { subject: { code: "asc" } },
    }),
);

/** Every coefficient row, for the matrix view. */
export const listCoefficients = cache(async () =>
  prisma.levelSubject.findMany({
    include: { subject: true, level: true, stream: true },
    orderBy: [{ level: { order: "asc" } }, { subject: { code: "asc" } }],
  }),
);
