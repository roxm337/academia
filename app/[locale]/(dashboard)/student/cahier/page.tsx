import { getTranslations, setRequestLocale } from "next-intl/server";
import { Paperclip } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card } from "@/components/ui/field";
import { requireRole } from "@/lib/dal";
import { activeClassOfStudent } from "@/lib/data/timetable";
import { classCahier } from "@/lib/data/cahier";
import { localized } from "@/lib/school";

export default async function Page({
  params,
}: PageProps<"/[locale]/student/cahier">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");

  const t = await getTranslations("cahier");
  const klass = await activeClassOfStudent(user.id);
  if (!klass) {
    return (
      <>
        <PageHeader title={t("myTitle")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  const entries = await classCahier(klass.id);
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title={t("myTitle")} />
      {entries.length === 0 ? (
        <EmptyState message={t("none")} />
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {localized(e.subject, locale)} · <span className="font-mono">{dateStr(e.date)}</span>
                  </p>
                </div>
                <Badge tone="neutral">{localized(e.subject, locale)}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm">{e.description}</p>
              {e.attachments.map((a) => (
                <a key={a.id} href={`/api/files/${a.file.path}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline">
                  <Paperclip className="size-3.5" />{a.file.filename}
                </a>
              ))}
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
