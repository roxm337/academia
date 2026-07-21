"use server";

import { getSessionUser } from "@/lib/dal";
import { setUserLocale } from "@/lib/preferences";
import { resolveLocale } from "@/i18n/routing";

/**
 * Persists the language the user browses in.
 *
 * The URL locale only lasts for the visit; this is what the school reads when
 * it sends a notification e-mail hours later, so without it someone who reads
 * the app in English still receives French mail. The locale switcher is the
 * only preference UI — the language you pick is the language you get.
 *
 * Anonymous visitors (landing page, login screen) simply get no write: there
 * is no row to attach the preference to, and their switch still works because
 * the URL carries it.
 */
export async function setLocalePreference(locale: string): Promise<void> {
  // A Server Action is its own entry point — the session is checked here, and
  // the locale is validated rather than trusted.
  const user = await getSessionUser();
  if (!user) return;

  if (user.locale === resolveLocale(locale)) return;
  await setUserLocale(user.id, locale);
}
