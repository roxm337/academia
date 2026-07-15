import { setRequestLocale } from "next-intl/server";
import { AnnouncementReaderView } from "@/components/comm/announcement-reader-view";
import { requireRole } from "@/lib/dal";

export default async function Page({
  params,
}: PageProps<"/[locale]/student/announcements">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  return <AnnouncementReaderView user={user} locale={locale} />;
}
