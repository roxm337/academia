import { getTranslations, setRequestLocale } from "next-intl/server";
import { Printer } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/field";
import { TimetableGrid } from "@/components/timetable-grid";
import { TimetablePicker } from "@/components/director/timetable-picker";
import {
  AddSlotButton,
  CopyRamadanForm,
  SlotForm,
} from "@/components/director/timetable-forms";
import { DeleteForm } from "@/components/director/delete-form";
import { requireRole } from "@/lib/dal";
import { deleteSlot } from "@/lib/actions/timetable";
import {
  classTeachingOptions,
  getClassSlots,
  listClassesLite,
} from "@/lib/data/timetable";
import { currentYear, listRooms } from "@/lib/data/structure";
import { localized } from "@/lib/school";
import {
  minToLabel,
  variantForDate,
  type TimetableVariant,
} from "@/lib/timetable";

export default async function TimetablePage({
  params,
  searchParams,
}: PageProps<"/[locale]/director/timetable">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("DIRECTOR");

  const t = await getTranslations("timetable");
  const sp = await searchParams;

  const classes = await listClassesLite();
  if (classes.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <EmptyState message={t("noClasses")} />
      </>
    );
  }

  const classId =
    (typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : null) ?? classes[0].id;
  const variant: TimetableVariant = sp.variant === "RAMADAN" ? "RAMADAN" : "NORMAL";

  const [pairsRaw, rooms, slots, year] = await Promise.all([
    classTeachingOptions(classId),
    listRooms(),
    getClassSlots(classId, variant),
    currentYear(),
  ]);

  const teacherName = (u: {
    firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string;
  }) =>
    locale === "ar"
      ? `${u.firstNameAr} ${u.lastNameAr}`
      : `${u.firstNameFr} ${u.lastNameFr}`;

  const pairs = pairsRaw.map((p) => ({
    subjectId: p.subjectId,
    teacherId: p.teacherId,
    label: `${localized(p.subject, locale)} — ${teacherName(p.teacher.user)}`,
  }));

  const roomOptions = rooms.map((r) => ({ id: r.id, name: r.name }));

  // Whether the Ramadan grid is what students would actually see today.
  const ramadanToday =
    year &&
    variantForDate(new Date(), year.ramadanStart, year.ramadanEnd) === "RAMADAN";

  const pdfHref = `/api/timetable/pdf?class=${classId}&variant=${variant}&locale=${locale}`;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <TimetablePicker classes={classes} classId={classId} variant={variant} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {variant === "RAMADAN" ? <CopyRamadanForm classId={classId} /> : null}
        <a
          href={pdfHref}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-black/[0.03]"
        >
          <Printer className="size-4" />
          {t("print")}
        </a>
        {ramadanToday && variant === "NORMAL" ? (
          <span className="text-xs text-amber-700">{t("ramadanActive")}</span>
        ) : null}
      </div>

      {pairs.length === 0 ? (
        <Card className="mb-4 text-sm text-amber-800">{t("noAssignments")}</Card>
      ) : null}

      <TimetableGrid
        variant={variant}
        slots={slots}
        renderEmpty={(weekday, period) => (
          <AddSlotButton
            classId={classId}
            variant={variant}
            pairs={pairs}
            rooms={roomOptions}
            weekday={weekday}
            startMin={period.startMin}
            endMin={period.endMin}
          />
        )}
        renderSlot={(s) => (
          <div className="group relative">
            <SlotForm
              classId={classId}
              variant={variant}
              pairs={pairs}
              rooms={roomOptions}
              slot={{
                id: s.id,
                subjectId: s.subjectId,
                teacherId: s.teacherId,
                roomId: s.roomId,
                weekday: s.weekday,
                startMin: s.startMin,
                endMin: s.endMin,
              }}
              trigger={
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 rounded-md bg-[var(--brand)]/10 p-1.5 text-start text-xs hover:bg-[var(--brand)]/20"
                >
                  <span className="font-semibold text-[var(--foreground)]">
                    {localized(s.subject, locale)}
                  </span>
                  <span className="text-[var(--muted)]">
                    {teacherName(s.teacher.user)}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--muted)]">
                    {minToLabel(s.startMin)}–{minToLabel(s.endMin)}
                    {s.room ? ` · ${s.room.name}` : ""}
                  </span>
                </button>
              }
            />
            <div className="absolute -top-1 -end-1 opacity-0 transition-opacity group-hover:opacity-100">
              <DeleteForm action={deleteSlot} id={s.id} />
            </div>
          </div>
        )}
      />
    </>
  );
}
