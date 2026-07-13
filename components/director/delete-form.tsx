"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";

/**
 * Delete with a reason.
 *
 * A refusal here is meaningful — "this class still has students", "this subject
 * already has grades" — so the error has to reach the director rather than
 * failing silently. That rules out a plain <form action>, whose action must
 * return void.
 */
export function DeleteForm({
  action,
  id,
  label,
  extra,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  label?: string;
  /** Extra hidden fields — this renders its own <form>, so it can't be nested. */
  extra?: Record<string, string>;
}) {
  const tc = useTranslations("director.common");
  const te = useTranslations("director.errors");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(tc("confirmDelete"))) e.preventDefault();
      }}
      className="inline-flex flex-col items-end"
    >
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={label ?? tc("delete")}
        className="text-red-700"
      >
        <Trash2 className="size-4" />
      </Button>

      {state?.error ? (
        <p role="alert" className="mt-1 max-w-48 text-end text-xs text-red-700">
          {te(state.error)}
        </p>
      ) : null}
    </form>
  );
}
