"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil } from "lucide-react";
import { saveAnnouncement } from "@/lib/actions/announcements";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

type Opt = { id: string; label: string };
const AUDIENCES = ["WHOLE_SCHOOL", "PARENTS", "TEACHERS", "CYCLE", "LEVEL", "CLASS"] as const;

export function AnnouncementForm({
  cycles,
  levels,
  classes,
  announcement,
}: {
  cycles: Opt[];
  levels: Opt[];
  classes: Opt[];
  announcement?: {
    id: string; titleAr: string; titleFr: string; bodyAr: string; bodyFr: string;
    audience: string; cycleId: string | null; levelId: string | null; classId: string | null;
    isPublished: boolean;
  };
}) {
  const t = useTranslations("announcements");
  const tc = useTranslations("common");
  const te = useTranslations("announcements.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAnnouncement, null);
  const [audience, setAudience] = useState(announcement?.audience ?? "WHOLE_SCHOOL");

  return (
    <Modal
      title={announcement ? t("edit") : t("new")}
      trigger={
        announcement ? (
          <Button variant="ghost" size="sm"><Pencil className="size-4" /></Button>
        ) : (
          <Button size="sm"><Plus className="size-4" />{t("new")}</Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {announcement ? <input type="hidden" name="id" value={announcement.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="titleFr">{t("titleFr")}</Label>
              <Input id="titleFr" name="titleFr" dir="ltr" lang="fr" required defaultValue={announcement?.titleFr} />
            </div>
            <div>
              <Label htmlFor="titleAr">{t("titleAr")}</Label>
              <Input id="titleAr" name="titleAr" dir="rtl" lang="ar" required defaultValue={announcement?.titleAr} />
            </div>
            <div>
              <Label htmlFor="bodyFr">{t("bodyFr")}</Label>
              <Textarea id="bodyFr" name="bodyFr" dir="ltr" lang="fr" rows={3} required defaultValue={announcement?.bodyFr} />
            </div>
            <div>
              <Label htmlFor="bodyAr">{t("bodyAr")}</Label>
              <Textarea id="bodyAr" name="bodyAr" dir="rtl" lang="ar" rows={3} required defaultValue={announcement?.bodyAr} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="audience">{t("audience")}</Label>
              <Select id="audience" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>{t(`audiences.${a}`)}</option>
                ))}
              </Select>
            </div>
            {audience === "CYCLE" ? (
              <div>
                <Label htmlFor="cycleId">{t("cycle")}</Label>
                <Select id="cycleId" name="cycleId" defaultValue={announcement?.cycleId ?? ""} required>
                  <option value="" disabled>—</option>
                  {cycles.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </div>
            ) : audience === "LEVEL" ? (
              <div>
                <Label htmlFor="levelId">{t("level")}</Label>
                <Select id="levelId" name="levelId" defaultValue={announcement?.levelId ?? ""} required>
                  <option value="" disabled>—</option>
                  {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </Select>
              </div>
            ) : audience === "CLASS" ? (
              <div>
                <Label htmlFor="classId">{t("class")}</Label>
                <Select id="classId" name="classId" defaultValue={announcement?.classId ?? ""} required>
                  <option value="" disabled>—</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </div>
            ) : null}
          </div>

          <div>
            <Label htmlFor="file">{t("attachment")}</Label>
            <input id="file" type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf"
              className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-black/[0.06] file:px-3 file:py-2 file:text-sm" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isPublished" defaultChecked={announcement?.isPublished ?? true} className="size-4" />
            <span className="text-sm">{t("publish")}</span>
          </label>

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
