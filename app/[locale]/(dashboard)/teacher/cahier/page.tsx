import { getTranslations, setRequestLocale } from "next-intl/server";
import { Paperclip } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/field";
import { ClassSubjectPicker } from "@/components/pedagogy/class-subject-picker";
import { CahierEntryModal } from "@/components/pedagogy/cahier-forms";
import { DeleteForm } from "@/components/director/delete-form";
import { requireRole } from "@/lib/dal";
import { deleteCahierEntry } from "@/lib/actions/cahier";
import { teacherClassSubjects } from "@/lib/data/grades";
import { cahierEntries } from "@/lib/data/cahier";
import { localized } from "@/lib/school";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/teacher/cahier">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");

  const t = await getTranslations("cahier");
  const sp = await searchParams;
  const profile = await teacherClassSubjects(user.id);

  if (!profile || profile.assignments.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <EmptyState message={t("noSubject")} />
      </>
    );
  }

  const classMap = new Map<string, string>();
  const subjectsByClass: Record<string, { id: string; label: string }[]> = {};
  for (const a of profile.assignments) {
    classMap.set(a.class.id, a.class.name);
    (subjectsByClass[a.class.id] ??= []).push({ id: a.subject.id, label: `${a.subject.code} — ${localized(a.subject, locale)}` });
  }
  const classes = [...classMap].map(([id, name]) => ({ id, label: name }));

  const classId = classes.some((c) => c.id === sp.class) ? String(sp.class) : classes[0].id;
  const subs = subjectsByClass[classId] ?? [];
  const subjectId = subs.some((s) => s.id === sp.subject) ? String(sp.subject) : (subs[0]?.id ?? "");
  const owns = profile.assignments.some((a) => a.class.id === classId && a.subject.id === subjectId);

  const entries = owns ? await cahierEntries(classId, subjectId) : [];
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ClassSubjectPicker ns="cahier" classes={classes} subjectsByClass={subjectsByClass} classId={classId} subjectId={subjectId} />

      <div className="mb-4">
        <CahierEntryModal classId={classId} subjectId={subjectId} />
      </div>

      {entries.length === 0 ? (
        <EmptyState message={t("none")} />
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">{dateStr(e.date)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <CahierEntryModal
                    classId={classId}
                    subjectId={subjectId}
                    entry={{ id: e.id, date: dateStr(e.date), title: e.title, description: e.description }}
                  />
                  <DeleteForm action={deleteCahierEntry} id={e.id} />
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{e.description}</p>
              {e.attachments.map((a) => (
                <a
                  key={a.id}
                  href={`/api/files/${a.file.path}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
                >
                  <Paperclip className="size-3.5" />
                  {a.file.filename}
                </a>
              ))}
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
