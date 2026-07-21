import { getTranslations } from "next-intl/server";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/field";
import type { Kpi } from "@/lib/data/dashboard";

/** A row of headline numbers for a role's dashboard. Labels come from dashboard.kpis.*. */
export async function KpiGrid({ items }: { items: Kpi[] }) {
  const t = await getTranslations("dashboard.kpis");
  if (items.length === 0) return null;
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={t("overview")}>
      {items.map((k) => (
        <Card key={k.key} className="relative min-h-28 overflow-hidden p-4">
          {/* Label first: on a register you read the column heading, then the
              figure. It also stops five cards reading as five loose numbers. */}
          <BarChart3 className="absolute end-4 top-4 size-4 text-[var(--rule-strong)]" aria-hidden="true" />
          <div className="eyebrow pe-7">{t(k.key)}</div>
          <div className="tabular mt-5 text-[1.75rem] font-semibold leading-none text-[var(--ink)]">
            {k.value}
          </div>
        </Card>
      ))}
    </section>
  );
}
