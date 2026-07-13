import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { dashboardPathFor, getSessionUser } from "@/lib/dal";
import { Landing } from "@/components/landing/landing";

/**
 * Public landing page. A signed-in visitor never sees it — they go straight to
 * their own dashboard.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (user) redirect({ href: dashboardPathFor(user.role), locale });

  return <Landing locale={locale} />;
}
