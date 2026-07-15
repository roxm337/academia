import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { KpiGrid } from "@/components/kpi";
import { requireRole } from "@/lib/dal";
import { teacherKpis } from "@/lib/data/dashboard";

export default async function Page({ params }: PageProps<"/[locale]/teacher">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");
  const t = await getTranslations("dashboard");
  const kpis = await teacherKpis(user.id);
  return (
    <>
      <PageHeader title={t("teacher")} subtitle={t("welcome", { name: locale === "ar" ? user.nameAr : user.name })} />
      <KpiGrid items={kpis} />
    </>
  );
}
