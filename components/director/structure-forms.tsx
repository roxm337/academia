"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil } from "lucide-react";
import {
  saveClass,
  saveLevel,
  saveStream,
  type ActionState,
} from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

type Option = { id: string; label: string };

function Errors({ state }: { state: ActionState }) {
  const t = useTranslations("director.errors");
  if (!state?.error) return null;
  return <FieldError>{t(state.error)}</FieldError>;
}

function SubmitRow({ pending, close }: { pending: boolean; close: () => void }) {
  const tc = useTranslations("common");
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={close}>
        {tc("cancel")}
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? tc("loading") : tc("save")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- class

export function ClassForm({
  levels,
  streamsByLevel,
  teachers,
  klass,
}: {
  levels: Option[];
  streamsByLevel: Record<string, Option[]>;
  teachers: Option[];
  klass?: {
    id: string;
    name: string;
    levelId: string;
    streamId: string | null;
    capacity: number | null;
    mainTeacherId: string | null;
  };
}) {
  const t = useTranslations("director.classes");
  const tc = useTranslations("director.common");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveClass,
    null,
  );

  // Streams depend on the level; keep it simple and list every stream, labelled
  // by level, rather than shipping a client-side dependent <select>.
  const allStreams = Object.entries(streamsByLevel).flatMap(([levelId, list]) =>
    list.map((s) => ({ ...s, levelId })),
  );

  return (
    <Modal
      title={klass ? t("newClass") : t("newClass")}
      trigger={
        klass ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("newClass")}
          </Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {klass ? <input type="hidden" name="id" value={klass.id} /> : null}

          <div>
            <Label htmlFor="name">{t("className")}</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={klass?.name}
              placeholder="2Bac PC - A"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="levelId">{t("level")}</Label>
              <Select
                id="levelId"
                name="levelId"
                required
                defaultValue={klass?.levelId ?? ""}
              >
                <option value="" disabled>
                  {tc("none")}
                </option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="streamId">{t("stream")}</Label>
              <Select
                id="streamId"
                name="streamId"
                defaultValue={klass?.streamId ?? ""}
              >
                <option value="">{t("noStream")}</option>
                {allStreams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="capacity">{t("capacity")}</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                max={80}
                dir="ltr"
                defaultValue={klass?.capacity ?? ""}
              />
            </div>

            <div>
              <Label htmlFor="mainTeacherId">{t("mainTeacher")}</Label>
              <Select
                id="mainTeacherId"
                name="mainTeacherId"
                defaultValue={klass?.mainTeacherId ?? ""}
              >
                <option value="">{tc("none")}</option>
                {teachers.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Errors state={state} />
          <CloseOnSuccess ok={state?.ok} close={close} />
          <SubmitRow pending={pending} close={close} />
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- level

export function LevelForm({
  cycles,
  level,
}: {
  cycles: Option[];
  level?: {
    id: string;
    cycleId: string;
    code: string;
    nameAr: string;
    nameFr: string;
    order: number;
  };
}) {
  const t = useTranslations("director.classes");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveLevel,
    null,
  );

  return (
    <Modal
      title={t("newLevel")}
      trigger={
        level ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            {t("newLevel")}
          </Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {level ? <input type="hidden" name="id" value={level.id} /> : null}

          <div>
            <Label htmlFor="cycleId">{t("cycle")}</Label>
            <Select
              id="cycleId"
              name="cycleId"
              required
              defaultValue={level?.cycleId ?? ""}
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="code">{t("code")}</Label>
              <Input
                id="code"
                name="code"
                required
                dir="ltr"
                defaultValue={level?.code}
                placeholder="2BAC"
              />
            </div>
            <div>
              <Label htmlFor="order">{t("order")}</Label>
              <Input
                id="order"
                name="order"
                type="number"
                min={0}
                dir="ltr"
                required
                defaultValue={level?.order ?? 0}
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
                defaultValue={level?.nameAr}
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
                defaultValue={level?.nameFr}
              />
            </div>
          </div>

          <Errors state={state} />
          <CloseOnSuccess ok={state?.ok} close={close} />
          <SubmitRow pending={pending} close={close} />
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- stream

export function StreamForm({ levels }: { levels: Option[] }) {
  const t = useTranslations("director.classes");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveStream,
    null,
  );

  return (
    <Modal
      title={t("newStream")}
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          {t("newStream")}
        </Button>
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <div>
            <Label htmlFor="s-levelId">{t("level")}</Label>
            <Select id="s-levelId" name="levelId" required defaultValue="">
              <option value="" disabled />
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-code">{t("code")}</Label>
              <Input id="s-code" name="code" required dir="ltr" placeholder="SM" />
            </div>
            <div />
            <div>
              <Label htmlFor="s-nameAr">{t("nameAr")}</Label>
              <Input id="s-nameAr" name="nameAr" required dir="rtl" lang="ar" />
            </div>
            <div>
              <Label htmlFor="s-nameFr">{t("nameFr")}</Label>
              <Input id="s-nameFr" name="nameFr" required dir="ltr" lang="fr" />
            </div>
          </div>

          <Errors state={state} />
          <CloseOnSuccess ok={state?.ok} close={close} />
          <SubmitRow pending={pending} close={close} />
        </form>
      )}
    </Modal>
  );
}
