import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AnnouncementForm } from "@/components/comm/announcement-form";
import { AnnouncementFeed } from "@/components/comm/announcement-feed";
import { allAnnouncements } from "@/lib/data/announcements";
import { listCycles, listLevels, listClasses } from "@/lib/data/structure";
import { localized } from "@/lib/school";

/** Author surface shared by the director and surveillant announcement pages. */
export async function AnnouncementAuthorView({ locale }: { locale: string }) {
  const t = await getTranslations("announcements");
  const [announcements, cycles, levels, classes] = await Promise.all([
    allAnnouncements(),
    listCycles(),
    listLevels(),
    listClasses(),
  ]);

  const editOptions = {
    cycles: cycles.map((c) => ({ id: c.id, label: localized(c, locale) })),
    levels: levels.map((l) => ({ id: l.id, label: `${l.code} — ${localized(l, locale)}` })),
    classes: classes.map((c) => ({ id: c.id, label: c.name })),
  };

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4">
        <AnnouncementForm cycles={editOptions.cycles} levels={editOptions.levels} classes={editOptions.classes} />
      </div>
      <AnnouncementFeed announcements={announcements} locale={locale} author editOptions={editOptions} />
    </>
  );
}
