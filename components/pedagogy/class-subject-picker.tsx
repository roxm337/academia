"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Label, Select } from "@/components/ui/field";

type Opt = { id: string; label: string };

/** Class → subject chooser (cahier + homework), scoped to the teacher's assignments. */
export function ClassSubjectPicker({
  ns,
  classes,
  subjectsByClass,
  classId,
  subjectId,
}: {
  ns: "cahier" | "homework";
  classes: Opt[];
  subjectsByClass: Record<string, Opt[]>;
  classId: string;
  subjectId: string;
}) {
  const t = useTranslations(ns);
  const router = useRouter();
  const pathname = usePathname();

  const go = (next: { c?: string; s?: string }) => {
    const c = next.c ?? classId;
    const subs = subjectsByClass[c] ?? [];
    const s = next.c ? (subs[0]?.id ?? "") : (next.s ?? subjectId);
    const params = new URLSearchParams();
    params.set("class", c);
    params.set("subject", s);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const subjects = subjectsByClass[classId] ?? [];

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="min-w-44">
        <Label htmlFor="pc">{t("selectClass")}</Label>
        <Select id="pc" value={classId} onChange={(e) => go({ c: e.target.value })}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </Select>
      </div>
      <div className="min-w-44">
        <Label htmlFor="ps">{t("selectSubject")}</Label>
        <Select id="ps" value={subjectId} onChange={(e) => go({ s: e.target.value })}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}
