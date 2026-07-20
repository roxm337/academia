import { defineRouting } from "next-intl/routing";

export const locales = ["fr", "en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "fr",
  localePrefix: "always",
});

/** Text direction for a locale — drives dir="rtl" on <html> and every layout. */
export function dirOf(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Regional formatting without coupling English to the French fallback. */
export function localeTag(locale: string): string {
  if (locale === "ar") return "ar-MA";
  if (locale === "en") return "en-GB";
  return "fr-MA";
}

/** Validate untrusted locale input, such as a Route Handler query parameter. */
export function resolveLocale(locale: string | null | undefined): Locale {
  return locales.includes(locale as Locale) ? (locale as Locale) : routing.defaultLocale;
}
