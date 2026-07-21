import { getTranslations, setRequestLocale } from "next-intl/server";
import { Printer } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { ReadOnlyTimetable } from "@/components/readonly-timetable";
import { requireRole } from "@/lib/dal";
import { getTeacherSlots, teacherProfileOf } from "@/lib/data/timetable";

export default async function Page({
  params,
}: PageProps<"/[locale]/teacher/timetable">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");

  const t = await getTranslations("timetable");

  const profile = await teacherProfileOf(user.id);
  if (!profile) {
    return (
      <>
        <PageHeader title={t("myTimetable")} />
        <EmptyState message={t("teacherNoProfile")} />
      </>
    );
  }


  const slots = await getTeacherSlots(profile.id);

  return (
    <>
      <PageHeader title={t("myTimetable")} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <a
          href={`/api/timetable/pdf?locale=${locale}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-black/[0.03]"
        >
          <Printer className="size-4" />
          {t("print")}
        </a>
      </div>
      <ReadOnlyTimetable
        slots={slots}
        locale={locale}
        mode="teacher"
      />
    </>
  );
}
