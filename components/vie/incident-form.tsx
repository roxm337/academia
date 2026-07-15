"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil } from "lucide-react";
import { saveIncident } from "@/lib/actions/discipline";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

type Option = { id: string; label: string };

const TYPES = ["BEHAVIOUR", "VIOLENCE", "CHEATING", "TARDINESS", "MATERIAL_DAMAGE", "OTHER"];
const SANCTIONS = ["NONE", "AVERTISSEMENT", "BLAME", "EXCLUSION_TEMPORAIRE", "CONSEIL_DISCIPLINE"];

export function IncidentModal({
  students,
  classes,
  incident,
}: {
  students: Option[];
  classes: Option[];
  incident?: {
    id: string;
    studentId: string;
    classId: string | null;
    type: string;
    sanction: string;
    description: string;
    occurredAt: string;
    exclusionFrom: string | null;
    exclusionTo: string | null;
  };
}) {
  const t = useTranslations("vie.discipline");
  const tt = useTranslations("vie.types");
  const ts = useTranslations("vie.sanctions");
  const tc = useTranslations("common");
  const te = useTranslations("vie.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveIncident,
    null,
  );

  return (
    <Modal
      title={incident ? t("editIncident") : t("newIncident")}
      trigger={
        incident ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("newIncident")}
          </Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {incident ? <input type="hidden" name="id" value={incident.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="studentId">{t("student")}</Label>
              <Select id="studentId" name="studentId" required defaultValue={incident?.studentId ?? ""}>
                <option value="" disabled>—</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="classId">{t("class")}</Label>
              <Select id="classId" name="classId" defaultValue={incident?.classId ?? ""}>
                <option value="">—</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="type">{t("type")}</Label>
              <Select id="type" name="type" required defaultValue={incident?.type ?? "BEHAVIOUR"}>
                {TYPES.map((x) => (
                  <option key={x} value={x}>{tt(x)}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sanction">{t("sanction")}</Label>
              <Select id="sanction" name="sanction" required defaultValue={incident?.sanction ?? "NONE"}>
                {SANCTIONS.map((x) => (
                  <option key={x} value={x}>{ts(x)}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="occurredAt">{t("occurredAt")}</Label>
              <Input id="occurredAt" name="occurredAt" type="date" dir="ltr" required defaultValue={incident?.occurredAt} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="exclusionFrom">{t("exclusionFrom")}</Label>
                <Input id="exclusionFrom" name="exclusionFrom" type="date" dir="ltr" defaultValue={incident?.exclusionFrom ?? ""} />
              </div>
              <div>
                <Label htmlFor="exclusionTo">{t("exclusionTo")}</Label>
                <Input id="exclusionTo" name="exclusionTo" type="date" dir="ltr" defaultValue={incident?.exclusionTo ?? ""} />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" name="description" required rows={3} defaultValue={incident?.description} />
          </div>

          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>{tc("cancel")}</Button>
            <Button type="submit" disabled={pending}>
              {pending ? tc("loading") : tc("save")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
