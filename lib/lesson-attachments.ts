import "server-only";

import { prisma } from "@/lib/prisma";
import { storeUpload, DOC_TYPES, type UploadError } from "@/lib/storage";
import { DOCX_MIME } from "@/lib/upload-accept";

/**
 * Convert a Word file to HTML so students can read it in the page.
 *
 * Done once, at upload, because conversion is the slow part and a lesson is
 * read far more often than it is edited. `mammoth` is imported lazily: it is a
 * few hundred kilobytes of parser that most uploads (a PDF, a photo) never
 * need, and a static import would pull it into every route that touches this
 * module.
 *
 * Never throws. A document the converter chokes on still gets stored and still
 * downloads — losing the teacher's file because we could not render a preview
 * of it would be a much worse outcome than not having the preview.
 */
async function convertDocx(file: File): Promise<string | null> {
  try {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.convertToHtml({ buffer });
    return result.value?.trim() ? result.value : null;
  } catch (e) {
    console.error("[lesson-attachments] docx conversion failed:", e);
    return null;
  }
}

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
    if (file.type === DOCX_MIME) {
      const readerHtml = await convertDocx(file);
      if (readerHtml) {
        await prisma.storedFile.update({
          where: { id: up.fileId },
          data: { readerHtml },
        });
      }
    }
    await prisma.lessonAttachment.create({ data: { lessonId, fileId: up.fileId } });
  }
  return firstError;
}
