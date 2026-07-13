import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { verifySession } from "@/lib/dal";
import { NAV } from "@/lib/nav";
import { getSchoolSettings, schoolName } from "@/lib/school";
import { logout } from "@/lib/actions/auth";

export default async function DashboardLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Authentication gate for every dashboard route. Actions re-check on their own.
  const user = await verifySession();
  const t = await getTranslations("roles");
  const settings = await getSchoolSettings();

  async function logoutAction() {
    "use server";
    await logout(locale);
  }

  return (
    <AppShell
      items={NAV[user.role]}
      schoolName={schoolName(settings, locale)}
      userName={locale === "ar" ? user.nameAr : user.name}
      roleLabel={t(user.role)}
      logout={logoutAction}
    >
      {children}
    </AppShell>
  );
}
