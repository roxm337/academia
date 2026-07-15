"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, ClipboardEdit, MessageSquare } from "lucide-react";
import {
  saveGradeItem,
  saveGrades,
  saveAppreciation,
} from "@/lib/actions/grades";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

function Err({ state }: { state: ActionState }) {
  const te = useTranslations("grades.errors");
  if (!state?.error) return null;
  return <FieldError>{te(state.error)}</FieldError>;
}

// ---------------------------------------------------------------- grade item

export function GradeItemModal({
  classId,
  subjectId,
  semesterId,
  item,
}: {
  classId: string;
  subjectId: string;
  semesterId: string;
  item?: { id: string; kind: string; index: number; label: string | null; maxScore: number; weight: number };
}) {
  const t = useTranslations("grades");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveGradeItem, null);

  return (
    <Modal
      title={item ? t("editItem") : t("newItem")}
      trigger={
        item ? (
          <Button variant="ghost" size="sm"><Pencil className="size-4" /></Button>
        ) : (
          <Button size="sm"><Plus className="size-4" />{t("newItem")}</Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="semesterId" value={semesterId} />
          {item ? <input type="hidden" name="id" value={item.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="kind">{t("kind")}</Label>
              <Select id="kind" name="kind" defaultValue={item?.kind ?? "CONTROLE"}>
                <option value="CONTROLE">{t("controle")}</option>
                <option value="ACTIVITE">{t("activite")}</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="index">{t("index")}</Label>
              <Input id="index" name="index" type="number" min={1} max={20} dir="ltr" required defaultValue={item?.index ?? 1} />
            </div>
            <div>
              <Label htmlFor="maxScore">{t("maxScore")}</Label>
              <Input id="maxScore" name="maxScore" type="number" min={1} max={100} step="0.5" dir="ltr" required defaultValue={item?.maxScore ?? 20} />
            </div>
            <div>
              <Label htmlFor="weight">{t("weight")}</Label>
              <Input id="weight" name="weight" type="number" min={0.25} max={10} step="0.25" dir="ltr" required defaultValue={item?.weight ?? 1} />
            </div>
          </div>
          <div>
            <Label htmlFor="label">{t("label")}</Label>
            <Input id="label" name="label" defaultValue={item?.label ?? ""} />
          </div>

          <Err state={state} />
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

// ---------------------------------------------------------------- scores

export function ScoresModal({
  item,
  roster,
  existing,
}: {
  item: { id: string; label: string; maxScore: number };
  roster: { id: string; label: string }[];
  existing: Record<string, number | null>;
}) {
  const t = useTranslations("grades");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveGrades, null);

  return (
    <Modal
      title={`${t("enterScores")} — ${item.label}`}
      trigger={<Button variant="outline" size="sm"><ClipboardEdit className="size-4" />{t("enterScores")}</Button>}
    >
      {(close) => (
        <form action={action} className="space-y-3">
          <input type="hidden" name="gradeItemId" value={item.id} />
          <ul className="divide-y divide-[var(--border)]">
            {roster.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm">{s.label}</span>
                <Input
                  name={`score:${s.id}`}
                  type="number"
                  min={0}
                  max={item.maxScore}
                  step="0.25"
                  dir="ltr"
                  defaultValue={existing[s.id] ?? ""}
                  className="h-9 w-24 text-center"
                  aria-label={`${t("score")} ${s.label}`}
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted)]">/ {item.maxScore}</p>
          <Err state={state} />
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

// ---------------------------------------------------------------- appreciation

export function AppreciationModal({
  studentId,
  classId,
  subjectId,
  semesterId,
  studentName,
  text,
}: {
  studentId: string;
  classId: string;
  subjectId: string;
  semesterId: string;
  studentName: string;
  text: string;
}) {
  const t = useTranslations("grades");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAppreciation, null);

  return (
    <Modal
      title={`${t("appreciation")} — ${studentName}`}
      trigger={<Button variant="ghost" size="sm"><MessageSquare className="size-4" /></Button>}
    >
      {(close) => (
        <form action={action} className="space-y-3">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="semesterId" value={semesterId} />
          <Textarea name="text" rows={4} defaultValue={text} />
          <Err state={state} />
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
