import { getTranslations } from "next-intl/server";
import { ArrowLeft, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Link, redirect } from "@/i18n/navigation";
import { Composer } from "@/components/comm/message-forms";
import { MarkThreadRead } from "@/components/comm/mark-read";
import { threadDetail } from "@/lib/data/messaging";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/dal";

/**
 * One conversation. Non-participants never get here — `threadDetail` returns
 * null for them and we bounce back to the list. Marks the thread read on view.
 */
export async function ThreadView({
  threadId,
  user,
  locale,
  basePath,
}: {
  threadId: string;
  user: SessionUser;
  locale: string;
  basePath: string;
}) {
  const t = await getTranslations("messages");
  const thread = await threadDetail(threadId, user.id);
  if (!thread) redirect({ href: basePath, locale });
  const th = thread!;

  const isAr = locale === "ar";
  const nameOf = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    isAr ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;

  return (
    <>
      <MarkThreadRead threadId={th.id} />
      <Link href={basePath} className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="size-4 rtl:-scale-x-100" />{t("back")}
      </Link>
      <PageHeader title={th.subject} subtitle={t(`kinds.${th.kind}`)} />

      <div className="space-y-3">
        {th.messages.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("noMessages")}</p>
        ) : (
          th.messages.map((m) => {
            const mine = m.senderId === user.id;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  mine ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] bg-[var(--surface)]",
                )}>
                  <p className={cn("mb-0.5 text-xs", mine ? "text-white/80" : "text-[var(--muted)]")}>
                    {mine ? t("you") : nameOf(m.sender)} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {m.attachments.map((a) => (
                    <a key={a.id} href={`/api/files/${a.file.path}`} target="_blank" rel="noopener"
                      className={cn("mt-1 inline-flex items-center gap-1 text-xs hover:underline", mine ? "text-white" : "text-[var(--brand)]")}>
                      <Paperclip className="size-3" />{a.file.filename}
                    </a>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Composer threadId={th.id} />
    </>
  );
}
