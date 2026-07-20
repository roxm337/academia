"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LABELS = {
  fr: { short: "FR", full: "Français" },
  en: { short: "EN", full: "English" },
  ar: { short: "AR", full: "العربية" },
} as const;

/** Swaps locale while staying on the same route. */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => router.replace(pathname, { locale: l })}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            l === locale
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--muted)] hover:bg-black/[0.04]",
          )}
        >
          <span className="sm:hidden">{LABELS[l].short}</span>
          <span className="hidden sm:inline">{LABELS[l].full}</span>
        </button>
      ))}
    </div>
  );
}
