import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** The single school's settings row. Created by the seed; id is always 1. */
export const getSchoolSettings = cache(async () => {
  return prisma.schoolSettings.findUnique({
    where: { id: 1 },
    include: { currentSchoolYear: { include: { semesters: true } } },
  });
});

/** Brand colours for the root layout. Falls back if the school isn't set up. */
export const getBrand = cache(async () => {
  try {
    const s = await getSchoolSettings();
    return {
      primaryColor: s?.primaryColor ?? "#1e6f5c",
      secondaryColor: s?.secondaryColor ?? "#c8a35a",
    };
  } catch {
    // Don't let a cold/unmigrated DB take the whole app down.
    return { primaryColor: "#1e6f5c", secondaryColor: "#c8a35a" };
  }
});

/** Localized school name. */
export function schoolName(
  settings: { nameAr: string; nameFr: string } | null,
  locale: string,
): string {
  if (!settings) return "";
  return locale === "ar" ? settings.nameAr : settings.nameFr;
}

/** Pick the right bilingual field for the active locale. */
export function localized<T extends { nameAr: string; nameFr: string }>(
  row: T,
  locale: string,
): string {
  return locale === "ar" ? row.nameAr : row.nameFr;
}
