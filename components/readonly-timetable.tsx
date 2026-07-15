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
}: {
  variant: TimetableVariant;
  slots: ReadSlot[];
  locale: string;
  mode: "teacher" | "student";
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

  return (
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
  );
}
