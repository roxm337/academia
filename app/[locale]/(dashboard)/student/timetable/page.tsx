import { getTranslations, setRequestLocale } from "next-intl/server";
import { Printer } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { ReadOnlyTimetable } from "@/components/readonly-timetable";
import { requireRole } from "@/lib/dal";
import { activeClassOfStudent, getClassSlots } from "@/lib/data/timetable";
import { weekdayOf } from "@/lib/attendance";

export default async function Page({
  params,
}: PageProps<"/[locale]/student/timetable">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");

  const t = await getTranslations("timetable");

  const klass = await activeClassOfStudent(user.id);
  if (!klass) {
    return (
      <>
        <PageHeader title={t("myTimetable")} />
        <EmptyState message={t("studentNoClass")} />
      </>
    );
  }


  const slots = await getClassSlots(klass.id);

  return (
    <>
      <PageHeader title={t("myTimetable")} subtitle={t("forClass", { name: klass.name })} />
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
        mode="student"
        todayWeekday={weekdayOf(new Date())}
        nowMinutes={new Date().getUTCHours() * 60 + new Date().getUTCMinutes()}
      />
    </>
  );
}
