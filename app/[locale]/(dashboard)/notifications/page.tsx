import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/field";
import { MarkAllNotificationsRead } from "@/components/comm/mark-read";
import { verifySession } from "@/lib/dal";
import { myNotifications } from "@/lib/data/notifications";

export default async function Page({
  params,
}: PageProps<"/[locale]/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await verifySession();

  const t = await getTranslations("notifications");
  const items = await myNotifications(user.id);
  const isAr = locale === "ar";
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <>
      <PageHeader title={t("title")} />
      <MarkAllNotificationsRead hasUnread={hasUnread} />

      {items.length === 0 ? (
        <EmptyState message={t("none")} />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const body = (
              <Card className={n.readAt ? "" : "border-[var(--brand)]"}>
                <div className="flex items-start gap-2">
                  {!n.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--brand)]" aria-label={t("unread")} /> : null}
                  <div className="min-w-0">
                    <p className="font-medium">{isAr ? n.titleAr : n.titleFr}</p>
                    <p className="text-sm text-[var(--muted)]">{isAr ? n.bodyAr : n.bodyFr}</p>
                    <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                      {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </p>
                  </div>
                </div>
              </Card>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <a href={`/${locale}${n.link}`} className="block">{body}</a>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
