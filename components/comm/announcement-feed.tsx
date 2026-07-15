import { getTranslations } from "next-intl/server";
import { Paperclip } from "lucide-react";
import { Badge, Card } from "@/components/ui/field";
import { DeleteForm } from "@/components/director/delete-form";
import { AnnouncementForm } from "@/components/comm/announcement-form";
import { MarkAnnouncementsRead } from "@/components/comm/mark-read";
import { deleteAnnouncement } from "@/lib/actions/announcements";

type Ann = {
  id: string;
  titleAr: string; titleFr: string; bodyAr: string; bodyFr: string;
  audience: string;
  cycleId: string | null; levelId: string | null; classId: string | null;
  isPublished: boolean;
  publishAt: Date;
  read?: boolean;
  author: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string };
  class: { name: string } | null;
  attachments: { id: string; file: { path: string; filename: string } }[];
};

/**
 * The announcement list. In reader mode it marks everything read on view and
 * shows an "unread" dot; in author mode it shows edit/delete and the draft
 * badge. Editing needs the target option lists, so those are passed through.
 */
export async function AnnouncementFeed({
  announcements,
  locale,
  author,
  editOptions,
}: {
  announcements: Ann[];
  locale: string;
  author: boolean;
  editOptions?: { cycles: { id: string; label: string }[]; levels: { id: string; label: string }[]; classes: { id: string; label: string }[] };
}) {
  const t = await getTranslations("announcements");
  const isAr = locale === "ar";
  const name = (u: Ann["author"]) => (isAr ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`);
  const unreadIds = announcements.filter((a) => a.read === false).map((a) => a.id);

  if (announcements.length === 0) {
    return <Card className="text-sm text-[var(--muted)]">{t("none")}</Card>;
  }

  return (
    <div className="space-y-3">
      {!author ? <MarkAnnouncementsRead ids={unreadIds} /> : null}
      {announcements.map((a) => (
        <Card key={a.id} className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                {a.read === false ? <span className="size-2 rounded-full bg-[var(--brand)]" aria-label={t("unread")} /> : null}
                <p className="font-medium">{isAr ? a.titleAr : a.titleFr}</p>
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {t("by")} {name(a.author)} · {a.publishAt.toISOString().slice(0, 10)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Badge tone="neutral">
                {t(`audiences.${a.audience}`)}{a.audience === "CLASS" && a.class ? ` · ${a.class.name}` : ""}
              </Badge>
              {author ? (
                <>
                  {!a.isPublished ? <Badge tone="warn">{t("draft")}</Badge> : null}
                  {editOptions ? (
                    <AnnouncementForm
                      cycles={editOptions.cycles}
                      levels={editOptions.levels}
                      classes={editOptions.classes}
                      announcement={{
                        id: a.id, titleAr: a.titleAr, titleFr: a.titleFr, bodyAr: a.bodyAr, bodyFr: a.bodyFr,
                        audience: a.audience, cycleId: a.cycleId, levelId: a.levelId, classId: a.classId, isPublished: a.isPublished,
                      }}
                    />
                  ) : null}
                  <DeleteForm action={deleteAnnouncement} id={a.id} />
                </>
              ) : null}
            </div>
          </div>
          <p className="whitespace-pre-wrap text-sm">{isAr ? a.bodyAr : a.bodyFr}</p>
          {a.attachments.map((att) => (
            <a key={att.id} href={`/api/files/${att.file.path}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline">
              <Paperclip className="size-3.5" />{att.file.filename}
            </a>
          ))}
        </Card>
      ))}
    </div>
  );
}
