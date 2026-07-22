import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, BookOpen, CheckCircle2, Paperclip } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/dal";
import { studentLesson } from "@/lib/data/lessons";
import { LessonCompleteForm, RecordLessonView } from "@/components/learning/lesson-complete-form";
import { AttachmentReader } from "@/components/learning/attachment-reader";
import { DocReader } from "@/components/learning/doc-reader";
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
            <ul className="mt-3 space-y-4">
              {lesson.attachments.map((attachment) => {
                const url = `/api/files/${attachment.file.path}`;
                const isPdf = attachment.file.mimeType === "application/pdf";
                const doc = attachment.file.readerHtml;

                return (
                  <li
                    key={attachment.id}
                    className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        <Paperclip className="size-4 text-[var(--muted)]" aria-hidden="true" />
                        {attachment.file.filename}
                      </span>
                      {/* Reading in the page is the point, but keeping the file
                          is still a legitimate thing to want — revision offline,
                          printing, handing it to a tutor. */}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener"
                        className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)]"
                      >
                        {t("download")}
                      </a>
                      {isPdf ? (
                        <AttachmentReader url={url} label={attachment.file.filename} />
                      ) : null}
                    </div>

                    {doc ? (
                      // Native <details>: a Word document opens and closes with
                      // no JavaScript at all, which is the right trade on the
                      // phones the students actually have.
                      <details className="mt-2 group">
                        <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-[var(--brand)] hover:underline">
                          <BookOpen className="size-4" aria-hidden="true" />
                          {t("read")}
                        </summary>
                        <div className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4">
                          <DocReader html={doc} arabic={arabic} />
                        </div>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
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
