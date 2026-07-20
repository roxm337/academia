import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/dal";
import { parentKpis } from "@/lib/data/dashboard";

export default async function Page({ params }: PageProps<"/[locale]/parent">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("PARENT");
  const t = await getTranslations("dashboard");
  const kpis = await parentKpis(user, locale);
  return (
    <>
      <PageHeader title={t("parent")} subtitle={t("welcome", { name: locale === "ar" ? user.nameAr : user.name })} />
      <RoleDashboard role="parent" kpis={kpis} />
    </>
  );
}
