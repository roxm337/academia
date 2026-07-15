import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AnnouncementFeed } from "@/components/comm/announcement-feed";
import { visibleAnnouncements } from "@/lib/data/announcements";
import type { SessionUser } from "@/lib/dal";

/** Read-only announcement feed for teacher / student / parent. */
export async function AnnouncementReaderView({ user, locale }: { user: SessionUser; locale: string }) {
  const t = await getTranslations("announcements");
  const announcements = await visibleAnnouncements(user);
  return (
    <>
      <PageHeader title={t("feedTitle")} />
      <AnnouncementFeed announcements={announcements} locale={locale} author={false} />
    </>
  );
}
