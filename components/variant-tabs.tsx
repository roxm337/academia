import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { TimetableVariant } from "@/lib/timetable";

/**
 * NORMAL / RAMADAN toggle for the read-only role views. Plain query-only
 * anchors — no client JavaScript, which matters on the student and parent
 * pages that must stay light on low-end phones. The relative `?variant=` href
 * keeps the current path (and its locale) intact.
 */
export async function VariantTabs({ variant }: { variant: TimetableVariant }) {
  const t = await getTranslations("timetable");
  return (
    <div className="mb-4 inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
      {(["NORMAL", "RAMADAN"] as const).map((v) => (
        <a
          key={v}
          href={`?variant=${v}`}
          aria-current={variant === v ? "true" : undefined}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            variant === v
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          {t(`variants.${v}`)}
        </a>
      ))}
    </div>
  );
}
