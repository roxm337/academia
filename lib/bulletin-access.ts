import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Who may read a bulletin.
 *
 * A Route Handler is its own entry point — it gets no protection from proxy.ts
 * or from the page that linked to it — so this is re-derived on every request
 * and shared by the single bulletin and the class booklet.
 */

export type Viewer = { id: string; role: string };

/** Is this teacher assigned to the class? */
export async function teachesClass(userId: string, classId: string): Promise<boolean> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return false;
  return Boolean(
    await prisma.teacherAssignment.findFirst({
      where: { teacherId: profile.id, classId },
      select: { id: true },
    }),
  );
}

/**
 * One student's bulletin. Students and parents only once results are
 * published — grade entry happens out of their view.
 */
export async function canReadBulletin(
  viewer: Viewer,
  studentId: string,
  classId: string,
  published: boolean,
): Promise<boolean> {
  if (viewer.role === "DIRECTOR") return true;
  if (viewer.role === "TEACHER") return teachesClass(viewer.id, classId);

  if (viewer.role === "STUDENT" && published) {
    const me = await prisma.studentProfile.findUnique({
      where: { userId: viewer.id },
      select: { id: true },
    });
    return me?.id === studentId;
  }

  if (viewer.role === "PARENT" && published) {
    return Boolean(
      await prisma.studentGuardian.findFirst({
        where: { studentId, guardian: { userId: viewer.id } },
        select: { studentId: true },
      }),
    );
  }

  return false;
}

/**
 * A whole class in one document. Staff only — a booklet contains every
 * classmate's marks and rank, which no family is entitled to see, however
 * published their own child's results are.
 */
export async function canReadBooklet(viewer: Viewer, classId: string): Promise<boolean> {
  if (viewer.role === "DIRECTOR") return true;
  if (viewer.role === "TEACHER") return teachesClass(viewer.id, classId);
  return false;
}
