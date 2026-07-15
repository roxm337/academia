import { getTranslations } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { NewThreadModal } from "@/components/comm/message-forms";
import { threadsForUser, messagingRecipients } from "@/lib/data/messaging";
import type { SessionUser } from "@/lib/dal";

/**
 * The user's conversations. `basePath` is the role's messages route
 * (e.g. "/parent/messages") so each thread links to its own view.
 */
export async function ThreadList({
  user,
  locale,
  basePath,
}: {
  user: SessionUser;
  locale: string;
  basePath: string;
}) {
  const t = await getTranslations("messages");
  const [threads, recipients] = await Promise.all([
    threadsForUser(user.id),
    messagingRecipients(user),
  ]);
  const isAr = locale === "ar";
  const nameOf = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    isAr ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;

  const recipientOpts = recipients.map((r) => ({
    userId: r.userId,
    label: `${nameOf(r.name)} · ${t(`kinds.${r.kind}`)}`,
  }));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4">
        <NewThreadModal recipients={recipientOpts} />
      </div>

      {threads.length === 0 ? (
        <EmptyState message={t("noThreads")} />
      ) : (
        <ul className="space-y-2">
          {threads.map((th) => {
            const others = th.participants.filter((p) => p.userId !== user.id);
            return (
              <li key={th.id}>
                <Link href={`${basePath}/${th.id}`} className="block">
                  <Card className="hover:bg-black/[0.02]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          {th.unread ? <span className="size-2 shrink-0 rounded-full bg-[var(--brand)]" aria-label={t("unread")} /> : null}
                          <span className="truncate">{th.subject}</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                          {others.map((p) => nameOf(p.user)).join(", ")}
                          {th.last ? ` — ${th.last.body}` : ""}
                        </p>
                      </div>
                      <Badge tone="neutral">{t(`kinds.${th.kind}`)}</Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
