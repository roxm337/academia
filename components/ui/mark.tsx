import { cn } from "@/lib/utils";

/**
 * A mark out of 20.
 *
 * The /20 is the unit the entire Moroccan system runs on — every average,
 * every bulletin line, every class statistic — so it gets one treatment used
 * everywhere rather than a different arrangement of `toFixed(2)` on each page.
 *
 * The number is set in tabular figures so a column of them lines up; the
 * denominator is small and muted because it is the same on every row and
 * carries no information once you know the scale.
 */

const MAX = 20;

/** The Moroccan mention bands, as a colour token. */
function bandOf(value: number): string {
  if (value >= 16) return "var(--mark-excellent)";
  if (value >= 14) return "var(--mark-good)";
  if (value >= 12) return "var(--mark-fair)";
  if (value >= 10) return "var(--mark-pass)";
  return "var(--mark-fail)";
}

export function Mark({
  value,
  /** Shown when there is no mark. Pass the caller's translated string. */
  emptyLabel,
  size = "md",
  showBar = false,
  className,
}: {
  value: number | null;
  emptyLabel: string;
  size?: "sm" | "md" | "lg";
  /** The band bar — reserve it for where a row is being compared to others. */
  showBar?: boolean;
  className?: string;
}) {
  const text = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-3xl",
  }[size];

  if (value === null) {
    return (
      <span className={cn("tabular text-[var(--muted)]", text, className)}>
        {emptyLabel}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <span className="inline-flex items-baseline gap-1">
        <span className={cn("tabular font-semibold tracking-tight", text)}>
          {value.toFixed(2)}
        </span>
        {/* aria-hidden: "15,02 slash 20" read aloud on every row is noise;
            the column header already says these are marks out of 20. */}
        <span className="text-xs font-medium text-[var(--muted)]" aria-hidden="true">
          /{MAX}
        </span>
      </span>

      {showBar ? (
        <span
          className="block h-1 w-full max-w-24 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full"
            style={{
              inlineSize: `${Math.max(2, (value / MAX) * 100)}%`,
              background: bandOf(value),
            }}
          />
        </span>
      ) : null}
    </span>
  );
}

/**
 * The headline average on a bulletin or dashboard — the one place the mark is
 * allowed to be loud.
 */
export function MarkHeadline({
  value,
  label,
  emptyLabel,
  meta,
}: {
  value: number | null;
  label: string;
  emptyLabel: string;
  /** e.g. "Rang 3 / 28 · Bien" — already localized by the caller. */
  meta?: string;
}) {
  return (
    <div className="border-t-2 border-[var(--rule-strong)] pt-4">
      <p className="eyebrow">{label}</p>
      <div className="mt-2">
        <Mark value={value} emptyLabel={emptyLabel} size="lg" />
      </div>
      {meta ? <p className="mt-1.5 text-sm text-[var(--muted)]">{meta}</p> : null}
    </div>
  );
}
