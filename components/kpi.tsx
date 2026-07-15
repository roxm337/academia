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
        <Card key={k.key}>
          <div className="text-2xl font-semibold tracking-tight">{k.value}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">{t(k.key)}</div>
        </Card>
      ))}
    </div>
  );
}
