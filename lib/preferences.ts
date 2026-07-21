import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveLocale, type Locale } from "@/i18n/routing";

/**
 * Writes a user's language preference.
 *
 * Plain module rather than a Server Action so the acceptance script can call
 * the real function instead of a copy of it — a "use server" module drags the
 * router runtime in and dies under tsx.
 *
 * Returns the locale actually stored, which is not always the one asked for:
 * anything unrecognised falls back to the default rather than writing junk
 * that would later pick the wrong e-mail template.
 */
export async function setUserLocale(
  userId: string,
  locale: string,
): Promise<Locale> {
  const next = resolveLocale(locale);
  await prisma.user.update({ where: { id: userId }, data: { locale: next } });
  return next;
}
