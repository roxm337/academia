"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Label, Select } from "@/components/ui/field";

/**
 * Class dropdown + NORMAL/RAMADAN tabs. Both live in the URL (`?class`,
 * `?variant`) so the grid stays a server render and the view is shareable and
 * back-button friendly.
 */
export function TimetablePicker({
  classes,
  classId,
}: {
  classes: { id: string; name: string }[];
  classId: string;
}) {
  const tt = useTranslations("timetable");
  const router = useRouter();
  const pathname = usePathname();

  const go = (next: { classId?: string }) => {
    const params = new URLSearchParams();
    params.set("class", next.classId ?? classId);
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

    </div>
  );
}
