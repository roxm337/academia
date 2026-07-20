import "server-only";

import { prisma } from "@/lib/prisma";
import { storeUpload, DOC_TYPES, type UploadError } from "@/lib/storage";

/**
 * Attaching resources to a lesson.
 *
 * Server-only but NOT "use server": the action imports it, and so do the
 * acceptance scripts, which cannot import a "use server" module (it drags the
 * Next router runtime in and dies outside a request).
 */

/**
 * Stores every file posted under `file` and links it to the lesson.
 *
 * Returns the first rejection, if any, having stored the rest — a teacher
 * attaching a worksheet plus one oversized scan keeps the worksheet and is
 * told about the scan, rather than losing both.
 */
export async function attachFiles(
  formData: FormData,
  lessonId: string,
  uploadedById: string,
): Promise<{ error: UploadError } | null> {
  // getAll, not get: attaching a worksheet AND its correction should not need
  // two round-trips through the form.
  const files = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return null;

  let firstError: { error: UploadError } | null = null;
  for (const file of files) {
    const up = await storeUpload(file, {
      uploadedById,
      folder: `lessons/${lessonId}`,
      allowed: DOC_TYPES,
    });
    if (!up.ok) {
      firstError ??= { error: up.error };
      continue;
    }
    await prisma.lessonAttachment.create({ data: { lessonId, fileId: up.fileId } });
  }
  return firstError;
}
