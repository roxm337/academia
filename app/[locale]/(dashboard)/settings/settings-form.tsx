"use client";

import { useActionState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { updateSettings, type SettingsState } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Input, Label } from "@/components/ui/field";
import { IMAGE_ACCEPT } from "@/lib/upload-accept";

type Settings = {
  nameAr: string;
  nameFr: string;
  logoPath: string | null;
  addressAr: string | null;
  addressFr: string | null;
  phone: string | null;
  email: string | null;
  primaryColor: string;
  secondaryColor: string;
  teachersCanTakeAttendance: boolean;
  allowTeacherParentMessaging: boolean;
  defaultControlesPerSemester: number;
  absenceAlertThreshold: number;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const te = useTranslations("director.errors");
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateSettings,
    null,
  );

  return (
    <form action={action} className="space-y-5">
      <Card>
        <h2 className="mb-4 font-medium">{t("identity")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nameAr">{t("nameAr")}</Label>
            <Input id="nameAr" name="nameAr" dir="rtl" lang="ar"
              defaultValue={settings.nameAr} required />
          </div>
          <div>
            <Label htmlFor="nameFr">{t("nameFr")}</Label>
            <Input id="nameFr" name="nameFr" dir="ltr" lang="fr"
              defaultValue={settings.nameFr} required />
          </div>
          <div>
            <Label htmlFor="addressAr">{t("addressAr")}</Label>
            <Input id="addressAr" name="addressAr" dir="rtl" lang="ar"
              defaultValue={settings.addressAr ?? ""} />
          </div>
          <div>
            <Label htmlFor="addressFr">{t("addressFr")}</Label>
            <Input id="addressFr" name="addressFr" dir="ltr" lang="fr"
              defaultValue={settings.addressFr ?? ""} />
          </div>
          <div>
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" name="phone" dir="ltr"
              defaultValue={settings.phone ?? ""} />
          </div>
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" dir="ltr"
              defaultValue={settings.email ?? ""} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-medium">{t("branding")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="primaryColor">{t("primaryColor")}</Label>
            <Input id="primaryColor" name="primaryColor" type="color"
              className="h-11 p-1" defaultValue={settings.primaryColor} />
          </div>
          <div>
            <Label htmlFor="secondaryColor">{t("secondaryColor")}</Label>
            <Input id="secondaryColor" name="secondaryColor" type="color"
              className="h-11 p-1" defaultValue={settings.secondaryColor} />
          </div>
        </div>

        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <Label htmlFor="logo">{t("logo")}</Label>
          <div className="flex flex-wrap items-center gap-4">
            {settings.logoPath ? (
              // Shown on the school's own colour, which is where it actually
              // sits in the sidebar and on the login screen.
              <span className="inline-flex shrink-0 rounded-lg bg-[var(--brand)] px-3 py-2">
                <Image
                  src={settings.logoPath}
                  alt=""
                  width={270}
                  height={79}
                  className="h-8 w-auto object-contain"
                  unoptimized
                />
              </span>
            ) : null}
            <Input
              id="logo"
              name="logo"
              type="file"
              accept={IMAGE_ACCEPT}
              className="h-auto flex-1 py-2 text-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--surface-sunken)] file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
          <p className="mt-1.5 text-xs text-[var(--muted)]">{t("logoHint")}</p>
          <FieldError>
            {state?.logoError ? te(state.logoError) : null}
          </FieldError>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-medium">{t("rules")}</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="teachersCanTakeAttendance"
              defaultChecked={settings.teachersCanTakeAttendance}
              className="size-4 accent-[var(--brand)]" />
            {t("teachersCanTakeAttendance")}
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="allowTeacherParentMessaging"
              defaultChecked={settings.allowTeacherParentMessaging}
              className="size-4 accent-[var(--brand)]" />
            {t("allowTeacherParentMessaging")}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="defaultControlesPerSemester">
                {t("defaultControles")}
              </Label>
              <Input id="defaultControlesPerSemester"
                name="defaultControlesPerSemester" type="number" min={1} max={10}
                dir="ltr"
                defaultValue={settings.defaultControlesPerSemester} />
            </div>
            <div>
              <Label htmlFor="absenceAlertThreshold">
                {t("absenceAlertThreshold")}
              </Label>
              <Input id="absenceAlertThreshold" name="absenceAlertThreshold"
                type="number" min={1} max={50} dir="ltr"
                defaultValue={settings.absenceAlertThreshold} />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("save")}
        </Button>
        {state?.ok ? (
          <p role="status" className="text-sm text-[var(--brand)]">
            {tc("saved")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
