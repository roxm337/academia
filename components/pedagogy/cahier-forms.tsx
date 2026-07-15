"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil } from "lucide-react";
import { saveCahierEntry } from "@/lib/actions/cahier";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

export function CahierEntryModal({
  classId,
  subjectId,
  entry,
}: {
  classId: string;
  subjectId: string;
  entry?: { id: string; date: string; title: string; description: string };
}) {
  const t = useTranslations("cahier");
  const tc = useTranslations("common");
  const te = useTranslations("cahier.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCahierEntry, null);

  return (
    <Modal
      title={entry ? t("editEntry") : t("newEntry")}
      trigger={
        entry ? (
          <Button variant="ghost" size="sm"><Pencil className="size-4" /></Button>
        ) : (
          <Button size="sm"><Plus className="size-4" />{t("newEntry")}</Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="subjectId" value={subjectId} />
          {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="date">{t("date")}</Label>
              <Input id="date" name="date" type="date" dir="ltr" required defaultValue={entry?.date} />
            </div>
            <div>
              <Label htmlFor="title">{t("entryTitle")}</Label>
              <Input id="title" name="title" required defaultValue={entry?.title} />
            </div>
          </div>
          <div>
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" name="description" rows={5} required defaultValue={entry?.description} />
          </div>
          <div>
            <Label htmlFor="file">{t("attachment")}</Label>
            <input
              id="file"
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-black/[0.06] file:px-3 file:py-2 file:text-sm"
            />
          </div>

          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>{tc("cancel")}</Button>
            <Button type="submit" disabled={pending}>{pending ? tc("loading") : tc("save")}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
