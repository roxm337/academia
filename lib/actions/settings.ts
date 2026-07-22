"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { IMAGE_TYPES, storeUpload, type UploadError } from "@/lib/storage";

const schema = z.object({
  nameAr: z.string().min(1),
  nameFr: z.string().min(1),
  addressAr: z.string().optional(),
  addressFr: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  teachersCanTakeAttendance: z.coerce.boolean(),
  allowTeacherParentMessaging: z.coerce.boolean(),
  defaultControlesPerSemester: z.coerce.number().int().min(1).max(10),
  absenceAlertThreshold: z.coerce.number().int().min(1).max(50),
});

export type SettingsState = {
  ok?: boolean;
  error?: string;
  /** Set when the settings saved but the new logo did not. */
  logoError?: UploadError;
} | null;

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  // Server Actions are a separate entry point — re-check the role here, never
  // rely on the page that rendered the form.
  const actor = await requireRole("DIRECTOR");

  const parsed = schema.safeParse({
    nameAr: formData.get("nameAr"),
    nameFr: formData.get("nameFr"),
    addressAr: formData.get("addressAr") ?? "",
    addressFr: formData.get("addressFr") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    teachersCanTakeAttendance: formData.get("teachersCanTakeAttendance") === "on",
    allowTeacherParentMessaging: formData.get("allowTeacherParentMessaging") === "on",
    defaultControlesPerSemester: formData.get("defaultControlesPerSemester"),
    absenceAlertThreshold: formData.get("absenceAlertThreshold"),
  });

  if (!parsed.success) return { error: "invalid" };

  const before = await prisma.schoolSettings.findUnique({ where: { id: 1 } });

  // The logo is optional on every save — an empty file input must leave the
  // current one alone rather than blanking it.
  let logoPath: string | undefined;
  let logoError: UploadError | undefined;
  const upload = formData.get("logo");
  if (upload instanceof File && upload.size > 0) {
    const stored = await storeUpload(upload, {
      uploadedById: actor.id,
      folder: "brand",
      allowed: IMAGE_TYPES,
    });
    if (stored.ok) {
      const file = await prisma.storedFile.findUniqueOrThrow({
        where: { id: stored.fileId },
        select: { path: true },
      });
      logoPath = `/api/files/${file.path}`;
    } else {
      // Saving the rest is still the right outcome — the director typed those
      // changes too, and losing them to a rejected image would be worse.
      logoError = stored.error;
    }
  }

  const after = await prisma.schoolSettings.update({
    where: { id: 1 },
    data: { ...parsed.data, ...(logoPath ? { logoPath } : {}) },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "SETTINGS_UPDATE",
      entity: "SchoolSettings",
      entityId: "1",
      before: before ? JSON.parse(JSON.stringify(before)) : undefined,
      after: JSON.parse(JSON.stringify(after)),
    },
  });

  revalidatePath("/", "layout");
  return { ok: true, logoError };
}
