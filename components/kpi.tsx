import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/field";
import type { Kpi } from "@/lib/data/dashboard";

/** A row of headline numbers for a role's dashboard. Labels come from dashboard.kpis.*. */
export async function KpiGrid({ items }: { items: Kpi[] }) {
  const t = await getTranslations("dashboard.kpis");
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((k) => (
        <Card key={k.key} className="p-4">
          {/* Label first: on a register you read the column heading, then the
              figure. It also stops five cards reading as five loose numbers. */}
          <div className="eyebrow">{t(k.key)}</div>
          <div className="tabular mt-2 text-[1.75rem] font-semibold leading-none tracking-tight text-[var(--ink)]">
            {k.value}
          </div>
        </Card>
      ))}
    </div>
  );
}
