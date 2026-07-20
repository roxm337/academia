import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { RoleDashboard } from "@/components/role-dashboard";
import { requireRole } from "@/lib/dal";
import { surveillantKpis } from "@/lib/data/dashboard";

export default async function Page({ params }: PageProps<"/[locale]/surveillant">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("SURVEILLANT");
  const t = await getTranslations("dashboard");
  const kpis = await surveillantKpis();
  return (
    <>
      <PageHeader title={t("surveillant")} subtitle={t("welcome", { name: locale === "ar" ? user.nameAr : user.name })} />
      <RoleDashboard role="surveillant" kpis={kpis} />
    </>
  );
}
