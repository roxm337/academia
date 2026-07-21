"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { saveSubject, setCoefficient, type ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

export function SubjectForm({
  subject,
}: {
  subject?: { id: string; code: string; nameAr: string; nameFr: string };
}) {
  const t = useTranslations("director.subjects");
  const tc = useTranslations("common");
  const te = useTranslations("director.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveSubject,
    null,
  );

  return (
    <Modal
      title={t("newSubject")}
      trigger={
        subject ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("newSubject")}
          </Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {subject ? <input type="hidden" name="id" value={subject.id} /> : null}

          <div>
            <Label htmlFor="code">{t("code")}</Label>
            <Input
              id="code"
              name="code"
              required
              dir="ltr"
              defaultValue={subject?.code}
              placeholder="MATH"
            />
          </div>
          <div>
            <Label htmlFor="nameAr">{t("nameAr")}</Label>
            <Input
              id="nameAr"
              name="nameAr"
              required
              dir="rtl"
              lang="ar"
              defaultValue={subject?.nameAr}
            />
          </div>
          <div>
            <Label htmlFor="nameFr">{t("nameFr")}</Label>
            <Input
              id="nameFr"
              name="nameFr"
              required
              dir="ltr"
              lang="fr"
              defaultValue={subject?.nameFr}
            />
          </div>

          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? tc("loading") : tc("save")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * One row of the coefficient matrix, saving on its own.
 *
 * Deliberately a grid row rather than a <tr>: a <form> is not valid inside
 * <tr>, and browsers hoist it out of the table, which silently breaks submits.
 */
export function CoefficientRow({
  levelId,
  specialityId,
  subjectId,
  label,
  value,
}: {
  levelId: string;
  specialityId: string;
  subjectId: string;
  label: string;
  value: number;
}) {
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setCoefficient,
    null,
  );

  return (
    <form
      action={action}
      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[var(--border)] px-3 py-2 last:border-b-0"
    >
      <input type="hidden" name="levelId" value={levelId} />
      <input type="hidden" name="specialityId" value={specialityId} />
      <input type="hidden" name="subjectId" value={subjectId} />

      <span className={value === 0 ? "text-[var(--muted)]" : ""}>{label}</span>

      <Input
        name="coefficient"
        type="number"
        step="0.5"
        min={0}
        max={20}
        dir="ltr"
        defaultValue={value}
        aria-label={label}
        className="h-9 w-20"
      />

      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? tc("loading") : state?.ok ? tc("saved") : tc("save")}
      </Button>
    </form>
  );
}
