"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Label, Select } from "@/components/ui/field";

/** Class chooser for the fees overview (keeps the selection in the URL). */
export function ClassPicker({ classes, classId }: { classes: { id: string; name: string }[]; classId: string }) {
  const t = useTranslations("fees");
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="min-w-52">
      <Label htmlFor="fc">{t("selectClass")}</Label>
      <Select id="fc" value={classId} onChange={(e) => router.replace(`${pathname}?class=${e.target.value}`)}>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
    </div>
  );
}
