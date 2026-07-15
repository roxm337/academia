"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { markAttendance, type AttendanceState } from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Status = "PRESENT" | "ABSENT" | "LATE";
type Student = { id: string; label: string };

const ORDER: Status[] = ["PRESENT", "ABSENT", "LATE"];
const TONE: Record<Status, string> = {
  PRESENT: "bg-emerald-600 text-white",
  ABSENT: "bg-red-600 text-white",
  LATE: "bg-amber-500 text-white",
};

/**
 * The roster for one lesson. Every student defaults to PRESENT (the common
 * case — you mark the exceptions), and "all present" resets in one tap.
 */
export function AttendanceRosterModal({
  lesson,
  roster,
  existing,
  trigger,
}: {
  lesson: { classId: string; date: string; slotId: string };
  roster: Student[];
  existing: Record<string, Status>;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("vie.attendance");
  const te = useTranslations("vie.errors");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<AttendanceState, FormData>(
    markAttendance,
    null,
  );

  const [statuses, setStatuses] = useState<Record<string, Status>>(() => {
    const init: Record<string, Status> = {};
    for (const s of roster) init[s.id] = existing[s.id] ?? "PRESENT";
    return init;
  });

  const allPresent = () =>
    setStatuses(Object.fromEntries(roster.map((s) => [s.id, "PRESENT"])));

  return (
    <Modal title={t("takeAttendance")} trigger={trigger}>
      {(close) => (
        <form action={action} className="space-y-3">
          <input type="hidden" name="classId" value={lesson.classId} />
          <input type="hidden" name="slotId" value={lesson.slotId} />
          <input type="hidden" name="date" value={lesson.date} />

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={allPresent}>
              {t("allPresent")}
            </Button>
          </div>

          <ul className="divide-y divide-[var(--border)]">
            {roster.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm">{s.label}</span>
                <div className="flex shrink-0 gap-1">
                  {ORDER.map((st) => {
                    const active = statuses[s.id] === st;
                    return (
                      <label
                        key={st}
                        className={cn(
                          "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium",
                          active ? TONE[st] : "bg-black/[0.05] text-[var(--muted)]",
                        )}
                      >
                        <input
                          type="radio"
                          name={`status:${s.id}`}
                          value={st}
                          checked={active}
                          onChange={() =>
                            setStatuses((prev) => ({ ...prev, [s.id]: st }))
                          }
                          className="sr-only"
                        />
                        {t(st.toLowerCase())}
                      </label>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending || roster.length === 0}>
              {pending ? tc("loading") : t("save")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
