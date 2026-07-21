import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen, CheckCircle2, ChevronRight } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/dal";
import { studentLessons } from "@/lib/data/lessons";
import { localized } from "@/lib/school";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("lessons");
  const arabic = locale === "ar";
  const { units } = await studentLessons(user.id);

  return (
    <>
      <PageHeader title={t("studentTitle")} subtitle={t("studentSubtitle")} />
      {units.length === 0 ? (
        <EmptyState message={t("noPublishedLessons")} />
      ) : (
        <div className="space-y-4">
          {units.map((unit) => (
            <Card key={unit.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{localized(unit.subject, locale)}</Badge>
                    <span className="text-xs text-[var(--muted)]">
                      {localized(unit.level, locale)}
                      {unit.speciality ? ` · ${localized(unit.speciality, locale)}` : ""}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold">
                    {arabic ? unit.titleAr : unit.titleFr}
                  </h2>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {unit.lessons.length} {t("lessonsCount")}
                </span>
              </div>

              <div className="grid gap-2">
                {unit.lessons.map((lesson) => {
                  const done = Boolean(lesson.progress[0]?.completedAt);
                  return (
                    <Link
                      key={lesson.id}
                      href={`/student/lessons/${lesson.id}`}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] p-3 transition hover:border-[var(--brand)] hover:bg-[var(--brand)]/[0.03]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--brand-soft)] text-[var(--brand)]">
                          {done ? (
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <BookOpen className="h-4 w-4" aria-hidden="true" />
                          )}
                        </span>
                        <span className="truncate text-sm font-medium">
                          {arabic ? lesson.titleAr : lesson.titleFr}
                        </span>
                        {done ? <span className="sr-only">{t("completed")}</span> : null}
                      </span>
                      {/* Points into the page — so it must flip, and nudge the
                          other way on hover, under dir="rtl". */}
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
