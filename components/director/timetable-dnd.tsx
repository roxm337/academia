"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { moveSlot } from "@/lib/actions/timetable";
import type { Weekday } from "@/lib/timetable";

/**
 * Drag-and-drop for the director's timetable.
 *
 * Native HTML5 drag events — no drag library. That keeps the bundle small (the
 * brief targets low-end Android) and there is nothing here a dependency would
 * do better for a grid of table cells.
 *
 * **Dragging is an accelerator, never the only way.** It is not keyboard
 * accessible, so every cell keeps its existing form: click an empty cell to add,
 * click a lesson to edit its day and time. A director on a keyboard, or on a
 * touch device where HTML5 drag is unreliable, loses nothing.
 */

type DragState = {
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  pending: boolean;
  error: string | null;
  move: (id: string, weekday: Weekday, startMin: number, endMin: number) => void;
};

const Ctx = createContext<DragState | null>(null);

export function TimetableDndProvider({ children }: { children: React.ReactNode }) {
  const tt = useTranslations("timetable");
  const te = useTranslations("director.errors");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const move = (id: string, weekday: Weekday, startMin: number, endMin: number) => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("weekday", weekday);
      fd.set("startMin", String(startMin));
      fd.set("endMin", String(endMin));
      const result = await moveSlot(null, fd);
      // A refused move must say why — "the teacher is already teaching then"
      // is the whole reason the director is looking at this screen.
      if (result?.error) {
        // Same wording as the form's conflict list — a clash is a clash however
        // the director caused it.
        const label: Record<string, string> = {
          class: tt("conflictClass"),
          teacher: tt("conflictTeacher"),
          room: tt("conflictRoom"),
        };
        setError(
          result.error === "conflict" && result.conflicts?.length
            ? result.conflicts.map((k) => label[k]).join(" · ")
            : te(result.error),
        );
      }
    });
  };

  return (
    <Ctx.Provider value={{ draggingId, setDraggingId, pending, error, move }}>
      {children}
      <DragStatus />
    </Ctx.Provider>
  );
}

function useDnd() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("timetable DnD components need TimetableDndProvider");
  return ctx;
}

/** Live region: a refused drop has to be announced, not just styled. */
function DragStatus() {
  const { pending, error } = useDnd();
  const t = useTranslations("timetable");
  if (!pending && !error) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-3 text-sm ${error ? "text-red-700" : "text-[var(--muted)]"}`}
    >
      {error ?? t("moving")}
    </p>
  );
}

/** Wraps a placed lesson so it can be picked up. */
export function DraggableSlot({
  slotId,
  children,
}: {
  slotId: string;
  children: React.ReactNode;
}) {
  const { setDraggingId, draggingId, pending } = useDnd();
  const isDragging = draggingId === slotId;

  return (
    <div
      draggable={!pending}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Some browsers refuse to start a drag without payload.
        e.dataTransfer.setData("text/plain", slotId);
        setDraggingId(slotId);
      }}
      onDragEnd={() => setDraggingId(null)}
      className={isDragging ? "opacity-40" : undefined}
    >
      {children}
    </div>
  );
}

/** An empty cell that accepts a dropped lesson. */
export function DropCell({
  weekday,
  startMin,
  endMin,
  children,
}: {
  weekday: Weekday;
  startMin: number;
  endMin: number;
  children: React.ReactNode;
}) {
  const { draggingId, setDraggingId, move } = useDnd();
  const [over, setOver] = useState(false);

  // Only light up while something is actually being dragged.
  const active = draggingId !== null;

  return (
    <div
      onDragOver={(e) => {
        if (!active) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain") || draggingId;
        setDraggingId(null);
        if (id) move(id, weekday, startMin, endMin);
      }}
      className={
        over
          ? "rounded-md outline-2 outline-dashed outline-[var(--brand)] outline-offset-[-2px]"
          : undefined
      }
    >
      {children}
    </div>
  );
}
