import { setRequestLocale } from "next-intl/server";
import { AnnouncementAuthorView } from "@/components/comm/announcement-author-view";
import { requireRole } from "@/lib/dal";

export default async function Page({
  params,
}: PageProps<"/[locale]/director/announcements">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("DIRECTOR");
  return <AnnouncementAuthorView locale={locale} />;
}
