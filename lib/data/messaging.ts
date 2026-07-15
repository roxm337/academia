import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school";
import type { SessionUser } from "@/lib/dal";

const nameSel = {
  select: { id: true, firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true, role: true },
} as const;

/** Threads the user is in, newest activity first, each with unread state. */
export const threadsForUser = cache(async (userId: string) => {
  const threads = await prisma.messageThread.findMany({
    where: { participants: { some: { userId } } },
    include: {
      participants: { include: { user: nameSel } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true, senderId: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return threads.map((th) => {
    const me = th.participants.find((p) => p.userId === userId);
    const last = th.messages[0] ?? null;
    const unread = Boolean(
      last &&
        last.senderId !== userId &&
        (!me?.lastReadAt || last.createdAt > me.lastReadAt),
    );
    return { ...th, last, unread };
  });
});

/** A thread's full transcript — but only if the caller is a participant. */
export const threadDetail = cache(async (threadId: string, userId: string) => {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      participants: { include: { user: nameSel } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: nameSel,
          attachments: { include: { file: true } },
        },
      },
    },
  });
  if (!thread || !thread.participants.some((p) => p.userId === userId)) return null;
  return thread;
});

export type Recipient = {
  userId: string;
  name: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string };
  kind: "PARENT_TEACHER" | "PARENT_ADMIN";
};

/**
 * Who this user may start a conversation with. Parent↔teacher requires the
 * school to allow it AND a real relationship (the teacher teaches the parent's
 * child); parent↔admin is always available. Directors reach parents; teachers
 * reach the parents of their own students.
 */
export const messagingRecipients = cache(async (user: SessionUser): Promise<Recipient[]> => {
  const settings = await getSchoolSettings();
  const allowTeacher = settings?.allowTeacherParentMessaging ?? true;
  const out: Recipient[] = [];

  if (user.role === "PARENT") {
    // Admins (directors) — always.
    const directors = await prisma.user.findMany({ where: { role: "DIRECTOR", isActive: true }, ...nameSel });
    out.push(...directors.map((d) => ({ userId: d.id, name: d, kind: "PARENT_ADMIN" as const })));
    if (allowTeacher) {
      const teachers = await prisma.user.findMany({
        where: {
          role: "TEACHER",
          teacherProfile: {
            assignments: {
              some: { class: { enrollments: { some: { isActive: true, student: { guardians: { some: { guardian: { userId: user.id } } } } } } } },
            },
          },
        },
        ...nameSel,
      });
      out.push(...teachers.map((t) => ({ userId: t.id, name: t, kind: "PARENT_TEACHER" as const })));
    }
  } else if (user.role === "TEACHER" && allowTeacher) {
    const parents = await prisma.user.findMany({
      where: {
        role: "PARENT",
        guardian: {
          students: {
            some: { student: { enrollments: { some: { isActive: true, class: { assignments: { some: { teacher: { userId: user.id } } } } } } } },
          },
        },
      },
      ...nameSel,
    });
    out.push(...parents.map((p) => ({ userId: p.id, name: p, kind: "PARENT_TEACHER" as const })));
  } else if (user.role === "DIRECTOR") {
    const parents = await prisma.user.findMany({ where: { role: "PARENT", isActive: true }, ...nameSel });
    out.push(...parents.map((p) => ({ userId: p.id, name: p, kind: "PARENT_ADMIN" as const })));
  }

  return out;
});

/** Unread thread count for a nav badge. */
export const unreadThreads = cache(async (userId: string) => {
  const list = await threadsForUser(userId);
  return list.filter((t) => t.unread).length;
});
