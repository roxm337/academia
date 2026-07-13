import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/dal";
import { getSchoolSettings } from "@/lib/school";

export default async function Page({
  params,
}: PageProps<"/[locale]/teacher">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireRole("TEACHER");
  const t = await getTranslations("dashboard");
  const settings = await getSchoolSettings();

  return (
    <>
      <PageHeader
        title={t("teacher")}
        subtitle={t("welcome", {
          name: locale === "ar" ? user.nameAr : user.name,
        })}
      />
      {settings?.currentSchoolYear ? (
        <p className="mb-4 text-sm text-[var(--muted)]">
          {t("schoolYear", { year: settings.currentSchoolYear.label })}
        </p>
      ) : null}
      <EmptyState message={t("noDataYet")} />
    </>
  );
}
