import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { KpiGrid } from "@/components/kpi";
import { requireRole } from "@/lib/dal";
import { studentKpis } from "@/lib/data/dashboard";

export default async function Page({ params }: PageProps<"/[locale]/student">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("dashboard");
  const kpis = await studentKpis(user, locale);
  return (
    <>
      <PageHeader title={t("student")} subtitle={t("welcome", { name: locale === "ar" ? user.nameAr : user.name })} />
      <KpiGrid items={kpis} />
    </>
  );
}
