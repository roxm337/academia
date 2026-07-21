import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, BellRing } from "lucide-react";
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
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <MarkAllNotificationsRead hasUnread={hasUnread} />

      {items.length === 0 ? (
        <EmptyState message={t("none")} />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const timestamp = new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(n.createdAt);
            const body = (
              <Card className={`group transition-[border-color,box-shadow] hover:border-[var(--rule-strong)] hover:shadow-md ${n.readAt ? "" : "border-[var(--brand)] bg-[var(--brand-soft)]/30"}`}>
                <div className="flex items-start gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${n.readAt ? "bg-[var(--surface-sunken)] text-[var(--muted)]" : "bg-[var(--brand)] text-white"}`}>
                    <BellRing className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--ink)]">{isAr ? n.titleAr : n.titleFr}</p>
                      {!n.readAt ? <span className="size-2 shrink-0 rounded-full bg-[var(--brand)]" aria-label={t("unread")} /> : null}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{isAr ? n.bodyAr : n.bodyFr}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {timestamp}
                    </p>
                  </div>
                  {n.link ? <ArrowUpRight className="ms-auto size-4 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--brand)] rtl:-scale-x-100" aria-hidden="true" /> : null}
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
