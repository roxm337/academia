import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { childrenOfParent, getSessionUser } from "@/lib/dal";
import { isPublicBrandAsset } from "@/lib/school";

/**
 * Serves an uploaded file.
 *
 * Route Handlers are a separate entry point — they get no protection from
 * proxy.ts or from the page that linked here. A student's birth certificate is
 * exactly the kind of thing that must not be readable by guessing a URL, so
 * this re-checks who is asking and what the file belongs to.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/files/[...key]">,
) {
  const { key } = await ctx.params;
  const storageKey = key.join("/");

  // One exception to "log in first": the school's own logo, which has to render
  // on the login screen itself. Checked against the exact stored value.
  const isLogo = await isPublicBrandAsset(storageKey);

  const user = await getSessionUser();
  if (!user && !isLogo) return new Response(null, { status: 401 });

  const file = await prisma.storedFile.findFirst({
    where: { path: storageKey },
    select: {
      id: true,
      path: true,
      filename: true,
      mimeType: true,
      studentDocuments: { select: { studentId: true } },
      lessonAttachments: { select: { lesson: { select: { isPublished: true } } } },
    },
  });
  if (!file) return new Response(null, { status: 404 });

  if (
    !isLogo &&
    !(await canRead(
      user!,
      file.studentDocuments.map((d) => d.studentId),
      file.lessonAttachments.map((a) => a.lesson.isPublished),
    ))
  ) {
    return new Response(null, { status: 403 });
  }

  // The key is a DB-stored value, but normalize anyway so a crafted "../.."
  // can never escape the storage root.
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");
  const full = path.resolve(root, file.path);
  if (!full.startsWith(root + path.sep)) {
    return new Response(null, { status: 400 });
  }

  try {
    const data = await readFile(full);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
        // Everything here is somebody's private record — except the logo, which
        // is on the public login page and reloaded on every single request.
        "Cache-Control": isLogo
          ? "public, max-age=3600"
          : "private, no-store",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

async function canRead(
  user: { id: string; role: string },
  studentIds: string[],
  /** Publication state of every lesson this file is attached to, if any. */
  lessonPublished: boolean[],
): Promise<boolean> {
  if (user.role === "DIRECTOR" || user.role === "SURVEILLANT") return true;

  // A draft lesson's attachment must stay invisible to the people the draft is
  // hidden from — otherwise the publish gate holds on the page but not on the
  // file behind it. Teachers keep access so they can review their own drafts.
  const isDraftResource =
    lessonPublished.length > 0 && !lessonPublished.some(Boolean);
  if (isDraftResource && (user.role === "STUDENT" || user.role === "PARENT")) {
    return false;
  }

  // Files not attached to a student record (e.g. homework and published lesson
  // attachments) are readable by any authenticated member of the school.
  if (studentIds.length === 0) return true;

  if (user.role === "PARENT") {
    const children = await childrenOfParent(user.id);
    return studentIds.some((id) => children.some((c) => c.id === id));
  }

  if (user.role === "STUDENT") {
    const me = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return Boolean(me && studentIds.includes(me.id));
  }

  return false;
}
