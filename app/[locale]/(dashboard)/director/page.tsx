import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/dal";
import { getSchoolSettings } from "@/lib/school";
import { directorKpis } from "@/lib/data/dashboard";

export default async function Page({ params }: PageProps<"/[locale]/director">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("DIRECTOR");
  const t = await getTranslations("dashboard");
  const [settings, kpis] = await Promise.all([getSchoolSettings(), directorKpis()]);
  return (
    <>
      <PageHeader title={t("director")} subtitle={t("welcome", { name: locale === "ar" ? user.nameAr : user.name })} />
      {settings?.currentSchoolYear ? (
        <p className="mb-4 text-sm text-[var(--muted)]">{t("schoolYear", { year: settings.currentSchoolYear.label })}</p>
      ) : null}
      <RoleDashboard role="director" kpis={kpis} />
    </>
  );
}
