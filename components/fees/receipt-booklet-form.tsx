"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/field";
import { Input, Label, Select } from "@/components/ui/field";

/**
 * Downloads every receipt issued in a date range as one PDF.
 *
 * A plain GET rather than a server action: the response is a file, and letting
 * the browser navigate to it keeps the download out of the React lifecycle.
 * Defaults to the current month, which is how a school batches them.
 */
export function ReceiptBookletForm({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const t = useTranslations("fees");
  const locale = useLocale();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const [from, setFrom] = useState(iso(firstOfMonth));
  const [to, setTo] = useState(iso(today));
  const [classId, setClassId] = useState("");

  const href =
    `/api/receipt/booklet?from=${from}&to=${to}&locale=${locale}` +
    (classId ? `&class=${classId}` : "");
  const valid = Boolean(from) && Boolean(to) && from <= to;

  return (
    <Card className="mb-8 space-y-3">
      <h2 className="text-lg font-semibold">{t("receiptBooklet")}</h2>
      <p className="text-sm text-[var(--muted)]">{t("receiptBookletHint")}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="rb-from">{t("from")}</Label>
          <Input
            id="rb-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="rb-to">{t("to")}</Label>
          <Input id="rb-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="min-w-44">
          <Label htmlFor="rb-class">{t("classLabel")}</Label>
          <Select id="rb-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t("allClasses")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {valid ? (
          <a
            href={href}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm hover:bg-black/[0.03]"
          >
            <Download className="size-4" aria-hidden="true" />
            {t("download")}
          </a>
        ) : (
          <span className="text-xs text-red-700">{t("invalidRange")}</span>
        )}
      </div>
    </Card>
  );
}
