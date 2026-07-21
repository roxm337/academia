import { getTranslations } from "next-intl/server";
import {
  minToLabel,
  periodIndexFor,
  PERIODS,
  WEEKDAYS,
  type Period,
  type Weekday,
} from "@/lib/timetable";

type GridSlot = { weekday: Weekday; startMin: number };

/**
 * The weekly grid, shared by the director's builder and the read-only teacher /
 * student / parent views. Columns are weekdays (they flow right-to-left under
 * `dir="rtl"` for free), rows are the period template.
 *
 * `renderSlot` draws a placed lesson; `renderEmpty` (optional) draws an empty
 * cell — the director passes an "add" button, the read-only views leave it out.
 * Conflict detection guarantees at most one lesson per class per band, so a
 * cell never has to stack two blocks.
 */
export async function TimetableGrid<T extends GridSlot>({
  slots,
  renderSlot,
  renderEmpty,
}: {
  slots: T[];
  renderSlot: (slot: T) => React.ReactNode;
  renderEmpty?: (weekday: Weekday, period: Period) => React.ReactNode;
}) {
  const t = await getTranslations("timetable");
  const periods = PERIODS;

  // Index lessons by "weekday#periodIndex" for O(1) cell lookup.
  const byCell = new Map<string, T>();
  for (const s of slots) {
    const pi = periodIndexFor(s.startMin, periods);
    if (pi === null) continue; // a lesson timed outside every band — skip drawing
    byCell.set(`${s.weekday}#${pi}`, s);
  }

  return (
    <div className="overflow-x-auto rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-20 border-b border-e border-[var(--rule-strong)] bg-[var(--surface-sunken)] px-2 py-2">
              <span className="eyebrow">{t("time")}</span>
            </th>
            {WEEKDAYS.map((d) => (
              <th
                key={d}
                className="border-b border-e border-[var(--rule-strong)] bg-[var(--surface-sunken)] px-2 py-2 text-center"
              >
                <span className="eyebrow">{t(`weekdays.${d}`)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p, pi) => (
            <tr key={pi}>
              <th className="code whitespace-nowrap border-b border-e border-[var(--line)] bg-[var(--surface-sunken)]/60 px-2 py-2 text-start align-top text-[11px] font-normal text-[var(--muted)]">
                {minToLabel(p.startMin)}
                <br />
                {minToLabel(p.endMin)}
              </th>
              {WEEKDAYS.map((d) => {
                const slot = byCell.get(`${d}#${pi}`);
                return (
                  <td
                    key={d}
                    className="h-16 border-b border-e border-[var(--line)] p-1 align-top"
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
