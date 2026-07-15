"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Label, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Class dropdown + NORMAL/RAMADAN tabs. Both live in the URL (`?class`,
 * `?variant`) so the grid stays a server render and the view is shareable and
 * back-button friendly.
 */
export function TimetablePicker({
  classes,
  classId,
  variant,
}: {
  classes: { id: string; name: string }[];
  classId: string;
  variant: "NORMAL" | "RAMADAN";
}) {
  const tt = useTranslations("timetable");
  const router = useRouter();
  const pathname = usePathname();

  const go = (next: { classId?: string; variant?: string }) => {
    const params = new URLSearchParams();
    params.set("class", next.classId ?? classId);
    params.set("variant", next.variant ?? variant);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="min-w-56">
        <Label htmlFor="class">{tt("selectClass")}</Label>
        <Select
          id="class"
          value={classId}
          onChange={(e) => go({ classId: e.target.value })}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div
        role="tablist"
        aria-label={tt("variantLabel")}
        className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
      >
        {(["NORMAL", "RAMADAN"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={variant === v}
            onClick={() => go({ variant: v })}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              variant === v
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {tt(`variants.${v}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
