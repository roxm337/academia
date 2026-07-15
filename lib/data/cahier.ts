import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

const entryInclude = {
  subject: true,
  teacher: { include: { user: true } },
  attachments: { include: { file: true } },
} as const;

/** Cahier de textes entries for one class+subject, newest first (teacher view). */
export const cahierEntries = cache(
  async (classId: string, subjectId: string) =>
    prisma.cahierEntry.findMany({
      where: { classId, subjectId },
      include: entryInclude,
      orderBy: { date: "desc" },
    }),
);

/** Every entry for a class, across subjects — the student/parent reading view. */
export const classCahier = cache(async (classId: string) =>
  prisma.cahierEntry.findMany({
    where: { classId },
    include: entryInclude,
    orderBy: { date: "desc" },
    take: 200,
  }),
);
