import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserCheck } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { localeTag } from "@/i18n/routing";
import { Badge, Card } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DayPicker } from "@/components/vie/day-picker";
import { AttendanceRosterModal } from "@/components/vie/attendance-form";
import { requireRole } from "@/lib/dal";
import { teacherProfileOf } from "@/lib/data/timetable";
import {
  teacherDaySlots,
  rosterFor,
  sessionRecords,
  dayStart,
  parseDay,
} from "@/lib/data/attendance";
import { getSchoolSettings, localized } from "@/lib/school";
import { minToLabel } from "@/lib/timetable";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/teacher/attendance">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");

  const t = await getTranslations("vie.attendance");
  const sp = await searchParams;

  const [profile, settings] = await Promise.all([
    teacherProfileOf(user.id),
    getSchoolSettings(),
  ]);
  if (!profile) {
    return (
      <>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  const date = parseDay(typeof sp.date === "string" ? sp.date : null) ?? dayStart(new Date());
  const dateStr = date.toISOString().slice(0, 10);
  const dayLabel = new Intl.DateTimeFormat(localeTag(locale), {
    weekday: "long", day: "numeric", month: "long",
  }).format(date);
  const { ctx, lessons } = await teacherDaySlots(profile.id, date);
  const canMark = settings?.teachersCanTakeAttendance ?? false;

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} eyebrow={dayLabel} />
      <DayPicker date={dateStr} />

      {!canMark ? (
        <Card className="mb-4 text-sm text-amber-800">{t("disabledForTeachers")}</Card>
      ) : null}

      {ctx.holiday ? (
        <Card className="text-sm text-amber-800">
          {t("holiday", { name: localized(ctx.holiday, locale) })}
        </Card>
      ) : lessons.length === 0 ? (
        <EmptyState message={t("noLessons")} />
      ) : (
        <ul className="space-y-2">
          {await Promise.all(
            lessons.map(async (l) => {
              const [roster, session] = await Promise.all([
                rosterFor(l.classId),
                sessionRecords(l.classId, date, l.startMin),
              ]);
              const existing: Record<string, "PRESENT" | "ABSENT" | "LATE"> = {};
              for (const r of session?.attendance ?? []) existing[r.studentId] = r.status;
              const done = l.markedCount > 0;
              const rosterOpts = roster.map((s) => ({ id: s.id, label: name(s.user) }));
              return (
                <li
                  key={l.slotId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {localized(l.subject, locale)} · {l.className}{" "}
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {minToLabel(l.startMin)}–{minToLabel(l.endMin)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={done ? "success" : "neutral"}>
                      {done ? t("marked", { marked: l.markedCount, total: l.rosterCount }) : t("notMarked")}
                    </Badge>
                    {canMark ? (
                      <AttendanceRosterModal
                        lesson={{ classId: l.classId, date: dateStr, slotId: l.slotId }}
                        roster={rosterOpts}
                        existing={existing}
                        trigger={
                          <Button size="sm" variant="outline">
                            <UserCheck className="size-4" />
                            {t("takeAttendance")}
                          </Button>
                        }
                      />
                    ) : null}
                  </div>
                </li>
              );
            }),
          )}
        </ul>
      )}
    </>
  );
}
