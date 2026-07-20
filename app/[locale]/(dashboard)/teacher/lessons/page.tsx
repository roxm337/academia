import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen, Paperclip } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card } from "@/components/ui/field";
import {
  LessonCreateModal,
  LessonEditModal,
  UnitEditModal,
} from "@/components/learning/lesson-modal";
import { DeleteForm } from "@/components/director/delete-form";
import { requireRole } from "@/lib/dal";
import { deleteLesson, deleteLessonAttachment, deleteUnit } from "@/lib/actions/lessons";
import { teacherContentOptions, teacherUnits } from "@/lib/data/lessons";
import { localized } from "@/lib/school";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");
  const t = await getTranslations("lessons");
  const arabic = locale === "ar";

  const content = await teacherContentOptions(user.id, locale);
  if (!content || content.options.length === 0) {
    return (
      <>
        <PageHeader title={t("teacherTitle")} subtitle={t("teacherSubtitle")} />
        <EmptyState message={t("noAssignments")} />
      </>
    );
  }
  const units = await teacherUnits(content.teacherId);

  return (
    <>
      <PageHeader title={t("teacherTitle")} subtitle={t("teacherSubtitle")} />
      <div className="mb-5 flex justify-end">
        <LessonCreateModal options={content.options} />
      </div>

      {units.length === 0 ? (
        <EmptyState message={t("noUnits")} />
      ) : (
        <div className="space-y-4">
          {units.map((unit) => (
            <Card key={unit.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{localized(unit.subject, locale)}</Badge>
                    <span className="text-xs text-[var(--muted)]">
                      {localized(unit.level, locale)}
                      {unit.stream ? ` · ${localized(unit.stream, locale)}` : ""}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold">
                    {arabic ? unit.titleAr : unit.titleFr}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <LessonCreateModal
                    options={content.options}
                    unit={{
                      id: unit.id,
                      levelId: unit.levelId,
                      streamId: unit.streamId,
                      subjectId: unit.subjectId,
                      titleAr: unit.titleAr,
                      titleFr: unit.titleFr,
                    }}
                  />
                  <UnitEditModal
                    unit={{ id: unit.id, titleAr: unit.titleAr, titleFr: unit.titleFr }}
                  />
                  <DeleteForm action={deleteUnit} id={unit.id} />
                </div>
              </div>

              <div className="space-y-2">
                {unit.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="rounded-lg border border-[var(--line)] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <BookOpen
                          className="h-4 w-4 shrink-0 text-[var(--brand)]"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {arabic ? lesson.titleAr : lesson.titleFr}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                            <span>{lesson.isPublished ? t("published") : t("draft")}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {lesson._count.progress} {t("views")}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {lesson.progress.length} {t("completions")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <LessonEditModal
                          lesson={{
                            id: lesson.id,
                            titleAr: lesson.titleAr,
                            titleFr: lesson.titleFr,
                            contentAr: lesson.contentAr,
                            contentFr: lesson.contentFr,
                            isPublished: lesson.isPublished,
                          }}
                        />
                        <DeleteForm action={deleteLesson} id={lesson.id} />
                      </div>
                    </div>

                    {/* Attachments belong to the lesson that owns them, not to
                        a pooled strip under the unit. */}
                    {lesson.attachments.length ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
                        {lesson.attachments.map((attachment) => (
                          <span key={attachment.id} className="inline-flex items-center gap-1">
                            <Paperclip className="size-3" aria-hidden="true" />
                            <a
                              href={`/api/files/${attachment.file.path}`}
                              target="_blank"
                              rel="noopener"
                              className="hover:text-[var(--brand)] hover:underline"
                            >
                              {attachment.file.filename}
                            </a>
                            <DeleteForm action={deleteLessonAttachment} id={attachment.id} />
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
