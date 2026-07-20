import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, CheckCircle2, Paperclip } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/dal";
import { studentLesson } from "@/lib/data/lessons";
import { LessonCompleteForm, RecordLessonView } from "@/components/learning/lesson-complete-form";
import { localized } from "@/lib/school";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("lessons");
  const lesson = await studentLesson(user.id, id);
  if (!lesson) {
    return (
      <>
        <PageHeader title={t("studentTitle")} />
        <EmptyState message={t("notFound")} />
      </>
    );
  }

  const arabic = locale === "ar";
  const complete = Boolean(lesson.progress[0]?.completedAt);

  return (
    <>
      <PageHeader
        title={arabic ? lesson.titleAr : lesson.titleFr}
        subtitle={`${arabic ? lesson.unit.titleAr : lesson.unit.titleFr} · ${localized(lesson.unit.subject, locale)}`}
      />
      {/* Records the view from an effect — a render must not write. */}
      <RecordLessonView lessonId={lesson.id} />

      <div className="mb-4">
        <Link
          href="/student/lessons"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--brand)]"
        >
          <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          {t("backToLessons")}
        </Link>
      </div>

      <article className="space-y-5">
        <Card className="p-6 sm:p-8">
          {/* Direction follows the field, not the page: a student reading the
              French UI can still open a lesson written in Arabic. */}
          <div
            dir={arabic ? "rtl" : "ltr"}
            lang={arabic ? "ar" : "fr"}
            className="whitespace-pre-wrap text-[0.98rem] leading-8 text-[var(--ink)]"
          >
            {arabic ? lesson.contentAr : lesson.contentFr}
          </div>
        </Card>

        {lesson.attachments.length ? (
          <Card>
            <h2 className="font-semibold">{t("resources")}</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {lesson.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={`/api/files/${attachment.file.path}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 text-sm text-[var(--brand)] hover:underline"
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                  {attachment.file.filename}
                </a>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {complete ? (
              <CheckCircle2 className="h-5 w-5 text-[var(--brand)]" aria-hidden="true" />
            ) : null}
            <span>{complete ? t("completed") : t("notCompleted")}</span>
          </div>
          <LessonCompleteForm lessonId={lesson.id} complete={complete} />
        </Card>
      </article>
    </>
  );
}
