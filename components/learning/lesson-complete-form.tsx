"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { markLessonComplete, recordLessonView } from "@/lib/actions/lessons";
import type { ActionState } from "@/lib/actions/structure";

/**
 * Marks the lesson done, or undoes it — a mis-click has to be reversible, so
 * the same button toggles rather than being a one-way door.
 */
export function LessonCompleteForm({
  lessonId,
  complete,
}: {
  lessonId: string;
  complete: boolean;
}) {
  const t = useTranslations("lessons");
  const te = useTranslations("lessons.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    markLessonComplete,
    null,
  );

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="lessonId" value={lessonId} />
      <button
        type="submit"
        disabled={pending}
        className={
          complete
            ? "rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-black/[0.04] disabled:opacity-60"
            : "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        }
      >
        {pending ? t("saving") : complete ? t("markIncomplete") : t("markComplete")}
      </button>
      {/* The real reason, not a fixed one — this action never returns
          "invalid", so hardcoding that key told the student nothing. */}
      {state?.error ? (
        <span className="text-xs text-red-700">{te(state.error)}</span>
      ) : null}
    </form>
  );
}

/**
 * Records that the lesson was opened. Runs in an effect rather than during the
 * page render, because writing to the database while rendering is a side
 * effect — same rule as the announcement and thread read receipts.
 */
export function RecordLessonView({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    // Fire-and-forget, and deliberately swallowed: a view counter must never
    // be able to take the lesson page down with it.
    void recordLessonView(lessonId).catch((e) => {
      console.error("[lesson-view] failed", e);
    });
  }, [lessonId]);
  return null;
}
