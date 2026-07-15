"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Label, Select } from "@/components/ui/field";

type Opt = { id: string; label: string };

/** Class + semester chooser (director grades overview and bulletins). */
export function ClassSemesterPicker({
  classes,
  semesters,
  classId,
  semesterId,
}: {
  classes: Opt[];
  semesters: Opt[];
  classId: string;
  semesterId: string;
}) {
  const t = useTranslations("grades");
  const router = useRouter();
  const pathname = usePathname();

  const go = (next: { c?: string; sem?: string }) => {
    const params = new URLSearchParams();
    params.set("class", next.c ?? classId);
    params.set("semester", next.sem ?? semesterId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="min-w-48">
        <Label htmlFor="dc">{t("selectClass")}</Label>
        <Select id="dc" value={classId} onChange={(e) => go({ c: e.target.value })}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </Select>
      </div>
      <div className="min-w-40">
        <Label htmlFor="dsem">{t("selectSemester")}</Label>
        <Select id="dsem" value={semesterId} onChange={(e) => go({ sem: e.target.value })}>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}
