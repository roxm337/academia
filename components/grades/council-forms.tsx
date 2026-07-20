"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { refreshCouncil, saveCouncilEntry } from "@/lib/actions/council";
import { COUNCIL_DECISIONS } from "@/lib/council";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Select } from "@/components/ui/field";

/** Recomputes the class's figures before or during the meeting. */
export function RefreshCouncilButton({
  classId,
  semesterId,
  disabled,
}: {
  classId: string;
  semesterId: string;
  disabled: boolean;
}) {
  const t = useTranslations("grades.council");
  const te = useTranslations("grades.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(refreshCouncil, null);

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="semesterId" value={semesterId} />
      <Button type="submit" variant="outline" disabled={pending || disabled}>
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("refresh")}
      </Button>
      {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
      {state?.ok ? (
        <span className="text-xs text-[var(--muted)]">{t("refreshed")}</span>
      ) : null}
    </form>
  );
}

/**
 * One student's council entry.
 *
 * The decision is a controlled vocabulary rather than free text: the bulletin
 * has to print it in the reader's language, which it cannot do with a sentence
 * the director typed in French.
 */
export function CouncilEntryForm({
  studentId,
  classId,
  semesterId,
  decision,
  directorAppreciation,
  suggestion,
  frozen,
}: {
  studentId: string;
  classId: string;
  semesterId: string;
  decision: string | null;
  directorAppreciation: string | null;
  suggestion: string | null;
  frozen: boolean;
}) {
  const t = useTranslations("grades.council");
  const tc = useTranslations("common");
  const te = useTranslations("grades.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCouncilEntry, null);

  if (frozen) {
    return (
      <div className="space-y-1 text-sm">
        <p>{decision ? t(`decisions.${decision}`) : t("noDecision")}</p>
        {directorAppreciation ? (
          <p className="text-xs text-[var(--muted)]">{directorAppreciation}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="semesterId" value={semesterId} />

      <Select
        name="decision"
        defaultValue={decision ?? ""}
        aria-label={t("decision")}
        className="min-w-44"
      >
        <option value="">{t("noDecision")}</option>
        {COUNCIL_DECISIONS.map((d) => (
          <option key={d} value={d}>
            {t(`decisions.${d}`)}
            {d === suggestion ? ` · ${t("suggestion")}` : ""}
          </option>
        ))}
      </Select>

      <Input
        name="directorAppreciation"
        defaultValue={directorAppreciation ?? ""}
        maxLength={500}
        aria-label={t("directorAppreciation")}
        placeholder={t("directorAppreciation")}
        className="min-w-52 flex-1"
      />

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? tc("loading") : tc("save")}
      </Button>
      {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
    </form>
  );
}
