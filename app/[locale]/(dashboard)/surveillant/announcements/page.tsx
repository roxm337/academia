import { setRequestLocale } from "next-intl/server";
import { AnnouncementAuthorView } from "@/components/comm/announcement-author-view";
import { requireRole } from "@/lib/dal";

export default async function Page({
  params,
}: PageProps<"/[locale]/surveillant/announcements">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SURVEILLANT");
  return <AnnouncementAuthorView locale={locale} />;
}
