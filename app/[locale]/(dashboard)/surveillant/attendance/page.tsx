import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserCheck } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DayPicker } from "@/components/vie/day-picker";
import { AttendanceRosterModal } from "@/components/vie/attendance-form";
import { requireRole } from "@/lib/dal";
import { listClassesLite } from "@/lib/data/timetable";
import {
  classDaySlots,
  rosterFor,
  sessionRecords,
  dayStart,
  parseDay,
} from "@/lib/data/attendance";
import { localized } from "@/lib/school";
import { minToLabel } from "@/lib/timetable";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/surveillant/attendance">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SURVEILLANT", "DIRECTOR");

  const t = await getTranslations("vie.attendance");
  const sp = await searchParams;

  const classes = await listClassesLite();
  if (classes.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  const classId =
    (typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : null) ?? classes[0].id;
  const date = parseDay(typeof sp.date === "string" ? sp.date : null) ?? dayStart(new Date());
  const dateStr = date.toISOString().slice(0, 10);

  const [{ ctx, lessons }, roster] = await Promise.all([
    classDaySlots(classId, date),
    rosterFor(classId),
  ]);

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;
  const rosterOpts = roster.map((s) => ({ id: s.id, label: name(s.user) }));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DayPicker classes={classes} classId={classId} date={dateStr} />

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
              const session = await sessionRecords(classId, date, l.startMin);
              const existing: Record<string, "PRESENT" | "ABSENT" | "LATE"> = {};
              for (const r of session?.attendance ?? []) existing[r.studentId] = r.status;
              const done = l.markedCount > 0;
              return (
                <li
                  key={l.slotId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {localized(l.subject, locale)}{" "}
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {minToLabel(l.startMin)}–{minToLabel(l.endMin)}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--muted)]">{name(l.teacher.user)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={done ? "success" : "neutral"}>
                      {done ? t("marked", { marked: l.markedCount, total: l.rosterCount }) : t("notMarked")}
                    </Badge>
                    <AttendanceRosterModal
                      lesson={{ classId, date: dateStr, slotId: l.slotId }}
                      roster={rosterOpts}
                      existing={existing}
                      trigger={
                        <Button size="sm" variant="outline">
                          <UserCheck className="size-4" />
                          {t("takeAttendance")}
                        </Button>
                      }
                    />
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
