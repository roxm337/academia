import "server-only";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { DOC_MIME, DOCX_MIME, IMAGE_MIME, LEGACY_DOC_MIME } from "@/lib/upload-accept";

/**
 * File storage.
 *
 * Local disk in dev, S3-compatible in prod. Callers only ever see this
 * interface, so swapping the driver never touches feature code.
 */
export interface StorageDriver {
  put(key: string, data: Buffer, mimeType: string): Promise<string>;
  delete(key: string): Promise<void>;
  url(key: string): string;
}

const LOCAL_DIR = process.env.STORAGE_LOCAL_DIR ?? "./storage";

const localDriver: StorageDriver = {
  async put(key, data) {
    const full = path.join(LOCAL_DIR, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return key;
  },
  async delete(key) {
    await unlink(path.join(LOCAL_DIR, key)).catch(() => {});
  },
  url(key) {
    // Served by app/api/files/[...key]/route.ts, which re-checks authorization.
    return `/api/files/${key}`;
  },
};

const s3Driver: StorageDriver = {
  async put() {
    throw new Error("S3 driver not configured yet (set STORAGE_DRIVER=local)");
  },
  async delete() {
    throw new Error("S3 driver not configured yet");
  },
  url(key) {
    return `${process.env.S3_PUBLIC_URL}/${key}`;
  },
};

export const storage: StorageDriver =
  process.env.STORAGE_DRIVER === "s3" ? s3Driver : localDriver;

// ---------------------------------------------------------------- uploads

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Defined in a client-safe module so the file inputs' `accept` attribute and
// this server-side validation stay one list.
export const IMAGE_TYPES: readonly string[] = IMAGE_MIME;
export const DOC_TYPES: readonly string[] = DOC_MIME;

export type UploadError = "tooLarge" | "badType" | "empty" | "legacyDoc";

/**
 * Validates and stores an uploaded file, returning the StoredFile row.
 * Rejects anything outside the allowed types — never trust the client's
 * declared mime alone, so the extension is derived from the allow-list.
 */
export async function storeUpload(
  file: File,
  opts: { uploadedById: string; folder: string; allowed?: readonly string[] },
): Promise<{ ok: true; fileId: string } | { ok: false; error: UploadError }> {
  if (!file || file.size === 0) return { ok: false, error: "empty" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooLarge" };

  const allowed = opts.allowed ?? DOC_TYPES;
  if (file.type === LEGACY_DOC_MIME) {
    // Distinguished from a plain bad type: the fix is one "Save As" away, and
    // saying so beats "file type not allowed" on a file Word itself produced.
    return { ok: false, error: "legacyDoc" };
  }
  if (!allowed.includes(file.type)) return { ok: false, error: "badType" };

  const ext = extensionFor(file.type);
  const key = `${opts.folder}/${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await storage.put(key, buffer, file.type);

  const stored = await prisma.storedFile.create({
    data: {
      path: key,
      filename: file.name.slice(0, 200),
      mimeType: file.type,
      size: file.size,
      uploadedById: opts.uploadedById,
    },
    select: { id: true },
  });

  return { ok: true, fileId: stored.id };
}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case DOCX_MIME:
      return ".docx";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}
