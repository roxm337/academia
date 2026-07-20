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
      primaryColor: s?.primaryColor ?? "#133562",
      secondaryColor: s?.secondaryColor ?? "#ef5b4e",
    };
  } catch {
    // Don't let a cold/unmigrated DB take the whole app down.
    return { primaryColor: "#133562", secondaryColor: "#ef5b4e" };
  }
});

/** Localized school name. */
export function schoolName(
  settings: { nameAr: string; nameFr: string } | null,
  locale: string,
): string {
  if (!settings) {
    return locale === "ar"
      ? "مدرسة بلانيت مونتيسوري الدولية"
      : "Planète Montessori International School";
  }
  return locale === "ar" ? settings.nameAr : settings.nameFr;
}

/** Pick a stored school-content field; English falls back to the French source. */
export function localized<T extends { nameAr: string; nameFr: string }>(
  row: T,
  locale: string,
): string {
  return locale === "ar" ? row.nameAr : row.nameFr;
}
