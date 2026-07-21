import { getTranslations, setRequestLocale } from "next-intl/server";
import { Paperclip, Users } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { ClassSubjectPicker } from "@/components/pedagogy/class-subject-picker";
import { HomeworkModal } from "@/components/pedagogy/homework-forms";
import { DeleteForm } from "@/components/director/delete-form";
import { requireRole } from "@/lib/dal";
import { deleteHomework } from "@/lib/actions/homework";
import { teacherClassSubjects } from "@/lib/data/grades";
import { teacherHomework } from "@/lib/data/homework";
import { localized } from "@/lib/school";
import { dueStatus } from "@/lib/homework";

const DUE_TONE = { upcoming: "neutral", dueSoon: "warn", overdue: "danger" } as const;

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/teacher/homework">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");

  const t = await getTranslations("homework");
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

  const homework = owns ? await teacherHomework(classId, subjectId) : [];
  const now = new Date();
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<HomeworkModal classId={classId} subjectId={subjectId} />} />
      <ClassSubjectPicker ns="homework" classes={classes} subjectsByClass={subjectsByClass} classId={classId} subjectId={subjectId} />

      {homework.length === 0 ? (
        <EmptyState message={t("none")} />
      ) : (
        <ul className="space-y-3">
          {homework.map((h) => {
            const status = dueStatus(h.dueAt, now);
            return (
              <Card key={h.id} className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{h.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={DUE_TONE[status]}>{t("dueDate")} {dateStr(h.dueAt)}</Badge>
                      <Badge tone={h.isPublished ? "success" : "neutral"}>
                        {h.isPublished ? t("published") : t("draft")}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <HomeworkModal
                      classId={classId}
                      subjectId={subjectId}
                      homework={{ id: h.id, title: h.title, instructions: h.instructions, dueDate: dateStr(h.dueAt), isPublished: h.isPublished }}
                    />
                    <DeleteForm action={deleteHomework} id={h.id} />
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm">{h.instructions}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {h.attachments.map((a) => (
                    <a key={a.id} href={`/api/files/${a.file.path}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline">
                      <Paperclip className="size-3.5" />{a.file.filename}
                    </a>
                  ))}
                  <Link
                    href={`/teacher/homework/${h.id}`}
                    className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <Users className="size-3.5" />
                    {t("submissions")}: {h._count.submissions}
                  </Link>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </>
  );
}
