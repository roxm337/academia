import { setRequestLocale } from "next-intl/server";
import { AnnouncementReaderView } from "@/components/comm/announcement-reader-view";
import { requireRole } from "@/lib/dal";

export default async function Page({
  params,
}: PageProps<"/[locale]/teacher/announcements">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");
  return <AnnouncementReaderView user={user} locale={locale} />;
}
