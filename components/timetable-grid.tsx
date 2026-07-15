import { getTranslations } from "next-intl/server";
import {
  minToLabel,
  periodIndexFor,
  periodsFor,
  WEEKDAYS,
  type Period,
  type TimetableVariant,
  type Weekday,
} from "@/lib/timetable";

type GridSlot = { weekday: Weekday; startMin: number };

/**
 * The weekly grid, shared by the director's builder and the read-only teacher /
 * student / parent views. Columns are weekdays (they flow right-to-left under
 * `dir="rtl"` for free), rows are the variant's period template.
 *
 * `renderSlot` draws a placed lesson; `renderEmpty` (optional) draws an empty
 * cell — the director passes an "add" button, the read-only views leave it out.
 * Conflict detection guarantees at most one lesson per class per band, so a
 * cell never has to stack two blocks.
 */
export async function TimetableGrid<T extends GridSlot>({
  variant,
  slots,
  renderSlot,
  renderEmpty,
}: {
  variant: TimetableVariant;
  slots: T[];
  renderSlot: (slot: T) => React.ReactNode;
  renderEmpty?: (weekday: Weekday, period: Period) => React.ReactNode;
}) {
  const t = await getTranslations("timetable");
  const periods = periodsFor(variant);

  // Index lessons by "weekday#periodIndex" for O(1) cell lookup.
  const byCell = new Map<string, T>();
  for (const s of slots) {
    const pi = periodIndexFor(s.startMin, periods);
    if (pi === null) continue; // a lesson timed outside every band — skip drawing
    byCell.set(`${s.weekday}#${pi}`, s);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-20 border-b border-e border-[var(--border)] px-2 py-2 text-xs font-semibold text-[var(--muted)]">
              {t("time")}
            </th>
            {WEEKDAYS.map((d) => (
              <th
                key={d}
                className="border-b border-e border-[var(--border)] px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
              >
                {t(`weekdays.${d}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p, pi) => (
            <tr key={pi}>
              <th className="whitespace-nowrap border-b border-e border-[var(--border)] px-2 py-2 text-start align-top font-mono text-[11px] font-normal text-[var(--muted)]">
                {minToLabel(p.startMin)}
                <br />
                {minToLabel(p.endMin)}
              </th>
              {WEEKDAYS.map((d) => {
                const slot = byCell.get(`${d}#${pi}`);
                return (
                  <td
                    key={d}
                    className="h-16 border-b border-e border-[var(--border)] p-1 align-top"
                  >
                    {slot
                      ? renderSlot(slot)
                      : renderEmpty
                        ? renderEmpty(d, p)
                        : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
