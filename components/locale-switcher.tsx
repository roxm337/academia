"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { setLocalePreference } from "@/lib/actions/preferences";
import { cn } from "@/lib/utils";

const LABELS = {
  fr: { short: "FR", full: "Français" },
  en: { short: "EN", full: "English" },
  ar: { short: "AR", full: "العربية" },
} as const;

/**
 * Swaps locale while staying on the same route, and remembers the choice.
 *
 * The write is deliberately not awaited: navigation must feel instant, and a
 * failed preference write should never block the language actually changing.
 * It is caught rather than left floating so a rejected promise can't take the
 * page down.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: (typeof routing.locales)[number]) {
    void setLocalePreference(next).catch(() => {});
    router.replace(pathname, { locale: next });
  }

  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          // Both labels are in the DOM so CSS can pick one per breakpoint;
          // without this a screen reader would read "FR Français".
          aria-label={LABELS[l].full}
          aria-pressed={l === locale}
          onClick={() => switchTo(l)}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            l === locale
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--muted)] hover:bg-black/[0.04]",
          )}
        >
          <span aria-hidden className="sm:hidden">{LABELS[l].short}</span>
          <span aria-hidden className="hidden sm:inline">{LABELS[l].full}</span>
        </button>
      ))}
    </div>
  );
}
