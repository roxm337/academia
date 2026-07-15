"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Label, Select } from "@/components/ui/field";

type Opt = { id: string; label: string };

/**
 * Class → subject → semester chooser for the gradebook. All three live in the
 * URL so the grid stays a server render. The subject list is scoped to the
 * chosen class (only pairs the teacher is assigned to).
 */
export function GradePicker({
  classes,
  subjectsByClass,
  semesters,
  classId,
  subjectId,
  semesterId,
}: {
  classes: Opt[];
  subjectsByClass: Record<string, Opt[]>;
  semesters: Opt[];
  classId: string;
  subjectId: string;
  semesterId: string;
}) {
  const t = useTranslations("grades");
  const router = useRouter();
  const pathname = usePathname();

  const go = (next: { c?: string; s?: string; sem?: string }) => {
    const c = next.c ?? classId;
    // Changing class may invalidate the subject — fall back to the first valid one.
    const subs = subjectsByClass[c] ?? [];
    const s = next.c
      ? (subs[0]?.id ?? "")
      : (next.s ?? subjectId);
    const params = new URLSearchParams();
    params.set("class", c);
    params.set("subject", s);
    params.set("semester", next.sem ?? semesterId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const subjects = subjectsByClass[classId] ?? [];

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="min-w-44">
        <Label htmlFor="gc">{t("selectClass")}</Label>
        <Select id="gc" value={classId} onChange={(e) => go({ c: e.target.value })}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </Select>
      </div>
      <div className="min-w-44">
        <Label htmlFor="gs">{t("selectSubject")}</Label>
        <Select id="gs" value={subjectId} onChange={(e) => go({ s: e.target.value })}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
      </div>
      <div className="min-w-40">
        <Label htmlFor="gsem">{t("selectSemester")}</Label>
        <Select id="gsem" value={semesterId} onChange={(e) => go({ sem: e.target.value })}>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}
