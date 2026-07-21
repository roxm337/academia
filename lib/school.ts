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

/**
 * The logo shipped with the repo, used until a school uploads its own.
 * Also the answer when the database cannot be reached at all.
 */
const BRAND_FALLBACK = {
  primaryColor: "#133562",
  secondaryColor: "#ef5b4e",
  logoPath: "/planete-montessori-private-school-marrakech-Frame-11.png",
} as const;

/** Brand for the root layout and every header. Falls back if the school isn't set up. */
export const getBrand = cache(async () => {
  try {
    const s = await getSchoolSettings();
    return {
      primaryColor: s?.primaryColor ?? BRAND_FALLBACK.primaryColor,
      secondaryColor: s?.secondaryColor ?? BRAND_FALLBACK.secondaryColor,
      logoPath: s?.logoPath ?? BRAND_FALLBACK.logoPath,
    };
  } catch {
    // Don't let a cold/unmigrated DB take the whole app down.
    return { ...BRAND_FALLBACK };
  }
});

/**
 * Is this storage key the school's current logo?
 *
 * The logo hangs on the login and landing pages, which are public by
 * definition, so it is the one uploaded file served without a session. The
 * comparison is against the exact stored value, never a folder prefix: an
 * upload must not be able to make itself public by choosing its own name.
 */
export async function isPublicBrandAsset(storageKey: string): Promise<boolean> {
  if (!storageKey) return false;
  try {
    const s = await getSchoolSettings();
    return s?.logoPath === `/api/files/${storageKey}`;
  } catch {
    return false;
  }
}

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
