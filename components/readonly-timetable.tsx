import { getTranslations } from "next-intl/server";
import { TimetableGrid } from "@/components/timetable-grid";
import { localized } from "@/lib/school";
import { minToLabel, type TimetableVariant, type Weekday } from "@/lib/timetable";

type UserName = {
  firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string;
};

type ReadSlot = {
  weekday: Weekday;
  startMin: number;
  endMin: number;
  subject: { nameAr: string; nameFr: string };
  room: { name: string } | null;
  teacher?: { user: UserName };
  class?: { name: string };
};

/**
 * A non-editable weekly grid for the teacher / student / parent views. `mode`
 * picks the second line of each block: a teacher sees which class, a student or
 * parent sees which teacher.
 */
export async function ReadOnlyTimetable({
  variant,
  slots,
  locale,
  mode,
  todayWeekday,
  nowMinutes,
}: {
  variant: TimetableVariant;
  slots: ReadSlot[];
  locale: string;
  mode: "teacher" | "student";
  todayWeekday?: Weekday;
  nowMinutes?: number;
}) {
  const t = await getTranslations("timetable");

  const name = (u: UserName) =>
    locale === "ar"
      ? `${u.firstNameAr} ${u.lastNameAr}`
      : `${u.firstNameFr} ${u.lastNameFr}`;

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
        {t("noSlots")}
      </div>
    );
  }

  const todaySlots = todayWeekday
    ? slots.filter((slot) => slot.weekday === todayWeekday).sort((a, b) => a.startMin - b.startMin)
    : [];
  const currentSlot = nowMinutes == null ? null : todaySlots.find((slot) => slot.startMin <= nowMinutes && nowMinutes < slot.endMin);
  const focusSlot = currentSlot ?? (nowMinutes == null ? null : todaySlots.find((slot) => slot.startMin > nowMinutes));

  return (
    <div className="space-y-4">
      {todayWeekday ? (
        <section className="rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/[0.05] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand)]">{t("today")}</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">{t(`weekdays.${todayWeekday}`)}</h2>
            </div>
            {focusSlot ? <span className="text-xs font-medium text-[var(--brand)]">{currentSlot ? t("currentLesson") : t("nextLesson")}</span> : null}
          </div>
          {todaySlots.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{t("noTodayLessons")}</p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {todaySlots.map((slot) => {
                const isFocus = focusSlot?.startMin === slot.startMin;
                return <div key={`${slot.startMin}-${slot.endMin}`} className={`rounded-lg border p-3 ${isFocus ? "border-[var(--brand)] bg-white shadow-sm" : "border-[var(--line)] bg-white/60"}`}>
                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]"><span className="font-mono">{minToLabel(slot.startMin)}–{minToLabel(slot.endMin)}</span>{isFocus ? <span className="font-semibold text-[var(--brand)]">{currentSlot ? t("currentLesson") : t("nextLesson")}</span> : null}</div>
                  <p className="mt-2 truncate text-sm font-semibold text-[var(--ink)]">{localized(slot.subject, locale)}</p>
                </div>;
              })}
            </div>
          )}
        </section>
      ) : null}
      <TimetableGrid
        variant={variant}
        slots={slots}
        renderSlot={(s) => (
          <div className="flex w-full flex-col gap-0.5 rounded-md bg-[var(--brand)]/10 p-1.5 text-xs">
          <span className="font-semibold">{localized(s.subject, locale)}</span>
          <span className="text-[var(--muted)]">
            {mode === "teacher"
              ? (s.class?.name ?? "")
              : s.teacher
                ? name(s.teacher.user)
                : ""}
          </span>
          <span className="font-mono text-[10px] text-[var(--muted)]">
            {minToLabel(s.startMin)}–{minToLabel(s.endMin)}
            {s.room ? ` · ${s.room.name}` : ""}
          </span>
          </div>
        )}
      />
    </div>
  );
}
