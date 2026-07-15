"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Label, Select } from "@/components/ui/field";

/**
 * Class + date chooser for the attendance pages. Both go in the URL so the
 * roster stays a server render. `classes` is omitted for the teacher view,
 * whose lessons are already scoped to them — only the date matters there.
 */
export function DayPicker({
  classes,
  classId,
  date,
}: {
  classes?: { id: string; name: string }[];
  classId?: string;
  date: string;
}) {
  const t = useTranslations("vie.attendance");
  const router = useRouter();
  const pathname = usePathname();

  const go = (next: { classId?: string; date?: string }) => {
    const params = new URLSearchParams();
    if (classes) params.set("class", next.classId ?? classId ?? "");
    params.set("date", next.date ?? date);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      {classes ? (
        <div className="min-w-52">
          <Label htmlFor="class">{t("selectClass")}</Label>
          <Select
            id="class"
            value={classId ?? ""}
            onChange={(e) => go({ classId: e.target.value })}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div>
        <Label htmlFor="date">{t("date")}</Label>
        <input
          id="date"
          type="date"
          dir="ltr"
          value={date}
          onChange={(e) => go({ date: e.target.value })}
          className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
        />
      </div>
    </div>
  );
}
