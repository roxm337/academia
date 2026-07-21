"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  saveSlot,
  type SlotState,
} from "@/lib/actions/timetable";
import { labelToMin, minToLabel, type Weekday } from "@/lib/timetable";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Select } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";
import { WEEKDAYS } from "@/lib/timetable";

// Deliberately not a second list: a day offered here but missing from the grid
// is a lesson the director can place and then never see again.
const DAYS: Weekday[] = WEEKDAYS;

type Pair = { subjectId: string; teacherId: string; label: string };
type Room = { id: string; name: string };

type SlotDefaults = {
  id?: string;
  subjectId?: string;
  teacherId?: string;
  roomId?: string | null;
  weekday?: Weekday;
  startMin?: number;
  endMin?: number;
};

/** The conflict / error line under the form. */
function Errors({ state }: { state: SlotState }) {
  const te = useTranslations("director.errors");
  const tt = useTranslations("timetable");
  if (!state?.error) return null;

  if (state.error === "conflict" && state.conflicts?.length) {
    const label: Record<string, string> = {
      class: tt("conflictClass"),
      teacher: tt("conflictTeacher"),
      room: tt("conflictRoom"),
    };
    return (
      <div role="alert" className="mt-1.5 text-sm text-red-700">
        <p className="font-medium">{tt("conflictsHeading")}</p>
        <ul className="list-inside list-disc">
          {state.conflicts.map((k) => (
            <li key={k}>{label[k]}</li>
          ))}
        </ul>
      </div>
    );
  }
  return <FieldError>{te(state.error)}</FieldError>;
}

/**
 * Add or edit one lesson. The teacher is not chosen freely — each option is a
 * (subject, teacher) pair the class actually has, so the form can't name a
 * teacher who doesn't teach that subject here. Times are entered as HH:MM and
 * converted to minutes in hidden fields the way the action expects.
 */
export function SlotForm({
  classId,
  pairs,
  rooms,
  slot,
  trigger,
}: {
  classId: string;
  pairs: Pair[];
  rooms: Room[];
  slot?: SlotDefaults;
  trigger: React.ReactNode;
}) {
  const tt = useTranslations("timetable");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<SlotState, FormData>(
    saveSlot,
    null,
  );

  const keyOf = (p: { subjectId: string; teacherId: string }) =>
    `${p.subjectId}::${p.teacherId}`;

  const [pairKey, setPairKey] = useState(
    slot?.subjectId && slot?.teacherId
      ? `${slot.subjectId}::${slot.teacherId}`
      : (pairs[0] ? keyOf(pairs[0]) : ""),
  );
  const [day, setDay] = useState<Weekday>(slot?.weekday ?? "MONDAY");
  const [start, setStart] = useState(
    minToLabel(slot?.startMin ?? 8 * 60),
  );
  const [end, setEnd] = useState(minToLabel(slot?.endMin ?? 9 * 60));

  const [subjectId, teacherId] = pairKey.split("::");
  const startMin = labelToMin(start);
  const endMin = labelToMin(end);

  return (
    <Modal title={slot?.id ? tt("editLesson") : tt("addLesson")} trigger={trigger}>
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="classId" value={classId} />
          {slot?.id ? <input type="hidden" name="id" value={slot.id} /> : null}
          <input type="hidden" name="subjectId" value={subjectId ?? ""} />
          <input type="hidden" name="teacherId" value={teacherId ?? ""} />
          <input type="hidden" name="weekday" value={day} />
          <input type="hidden" name="startMin" value={startMin ?? ""} />
          <input type="hidden" name="endMin" value={endMin ?? ""} />

          <div>
            <Label htmlFor="pair">{tt("subject")}</Label>
            <Select
              id="pair"
              value={pairKey}
              onChange={(e) => setPairKey(e.target.value)}
              required
            >
              {pairs.map((p) => (
                <option key={keyOf(p)} value={keyOf(p)}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="day">{tt("day")}</Label>
              <Select
                id="day"
                value={day}
                onChange={(e) => setDay(e.target.value as Weekday)}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {tt(`weekdays.${d}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="room">{tt("room")}</Label>
              <Select id="room" name="roomId" defaultValue={slot?.roomId ?? ""}>
                <option value="">{tt("noRoom")}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="start">{tt("startTime")}</Label>
              <input
                id="start"
                type="time"
                dir="ltr"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="end">{tt("endTime")}</Label>
              <input
                id="end"
                type="time"
                dir="ltr"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </div>
          </div>

          <Errors state={state} />
          <CloseOnSuccess ok={state?.ok} close={close} />

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending || pairs.length === 0}>
              {pending ? tc("loading") : tc("save")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** "+" trigger used inside an empty grid cell. */
export function AddSlotButton({
  classId,
  pairs,
  rooms,
  weekday,
  startMin,
  endMin,
}: {
  classId: string;
  pairs: Pair[];
  rooms: Room[];
  weekday: Weekday;
  startMin: number;
  endMin: number;
}) {
  const tt = useTranslations("timetable");
  if (pairs.length === 0) return null;
  return (
    <SlotForm
      classId={classId}
      pairs={pairs}
      rooms={rooms}
      slot={{ weekday, startMin, endMin }}
      trigger={
        <button
          type="button"
          aria-label={tt("addLesson")}
          className="flex h-full min-h-14 w-full items-center justify-center rounded-md text-[var(--muted)] opacity-0 transition-opacity hover:bg-black/[0.03] focus:opacity-100 hover:opacity-100"
        >
          <Plus className="size-4" />
        </button>
      }
    />
  );
}

