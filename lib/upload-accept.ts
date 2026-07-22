/**
 * Upload MIME allow-lists, in a client-safe module.
 *
 * `lib/storage.ts` is server-only (it touches the filesystem and Prisma), but
 * the file inputs that must advertise the same list live in client components.
 * Both sides import from here so the browser's `accept` and the server's
 * validation can never drift apart.
 */

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** Word, .docx only — the modern zip-based format the converter can read. */
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const;

/**
 * Word 97-2003. Accepted by the picker on purpose so the upload can be refused
 * with "save it as .docx" instead of the browser silently greying the file out,
 * which looks like the app is broken.
 */
export const LEGACY_DOC_MIME = "application/msword" as const;

export const DOC_MIME = [...IMAGE_MIME, "application/pdf", DOCX_MIME] as const;

/** Ready for an <input type="file" accept={...}>. */
export const IMAGE_ACCEPT = IMAGE_MIME.join(",");
export const DOC_ACCEPT = [...DOC_MIME, LEGACY_DOC_MIME].join(",");
