/**
 * Upload MIME allow-lists, in a client-safe module.
 *
 * `lib/storage.ts` is server-only (it touches the filesystem and Prisma), but
 * the file inputs that must advertise the same list live in client components.
 * Both sides import from here so the browser's `accept` and the server's
 * validation can never drift apart.
 */

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export const DOC_MIME = [...IMAGE_MIME, "application/pdf"] as const;

/** Ready for an <input type="file" accept={...}>. */
export const IMAGE_ACCEPT = IMAGE_MIME.join(",");
export const DOC_ACCEPT = DOC_MIME.join(",");
