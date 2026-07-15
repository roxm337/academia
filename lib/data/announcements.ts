import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { canSeeAnnouncement, type ViewerContext } from "@/lib/announcements";
import type { SessionUser } from "@/lib/dal";

/** Expand a set of class ids into the class/level/cycle ids they belong to. */
async function reachOf(classIds: string[]): Promise<{
  classIds: Set<string>;
  levelIds: Set<string>;
  cycleIds: Set<string>;
}> {
  const classes = classIds.length
    ? await prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, levelId: true, level: { select: { cycleId: true } } },
      })
    : [];
  return {
    classIds: new Set(classes.map((c) => c.id)),
    levelIds: new Set(classes.map((c) => c.levelId)),
    cycleIds: new Set(classes.map((c) => c.level.cycleId)),
  };
}

/** The classes/levels/cycles a user belongs to, for announcement targeting. */
export const viewerContext = cache(async (user: SessionUser): Promise<ViewerContext> => {
  let classIds: string[] = [];
  if (user.role === "STUDENT") {
    const enr = await prisma.enrollment.findMany({
      where: { student: { userId: user.id }, isActive: true },
      select: { classId: true },
    });
    classIds = enr.map((e) => e.classId);
  } else if (user.role === "PARENT") {
    const enr = await prisma.enrollment.findMany({
      where: { student: { guardians: { some: { guardian: { userId: user.id } } } }, isActive: true },
      select: { classId: true },
    });
    classIds = enr.map((e) => e.classId);
  } else if (user.role === "TEACHER") {
    const a = await prisma.teacherAssignment.findMany({
      where: { teacher: { userId: user.id } },
      select: { classId: true },
    });
    classIds = a.map((x) => x.classId);
  }
  const reach = await reachOf([...new Set(classIds)]);
  return { role: user.role, ...reach };
});

const annInclude = {
  author: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true } },
  cycle: true,
  level: true,
  class: { select: { name: true } },
  attachments: { include: { file: true } },
} as const;

/**
 * Published announcements this user should see, newest first, each tagged with
 * whether they've read it. Staff (director/surveillant) see everything; everyone
 * else is filtered by the audience matcher.
 */
export const visibleAnnouncements = cache(async (user: SessionUser) => {
  const rows = await prisma.announcement.findMany({
    where: { isPublished: true },
    include: annInclude,
    orderBy: { publishAt: "desc" },
    take: 100,
  });

  const staff = user.role === "DIRECTOR" || user.role === "SURVEILLANT";
  const ctx = staff ? null : await viewerContext(user);
  const visible = staff ? rows : rows.filter((a) => ctx && canSeeAnnouncement(a, ctx));

  const reads = await prisma.announcementRead.findMany({
    where: { userId: user.id, announcementId: { in: visible.map((a) => a.id) } },
    select: { announcementId: true },
  });
  const readSet = new Set(reads.map((r) => r.announcementId));

  return visible.map((a) => ({ ...a, read: readSet.has(a.id) }));
});

/** Count of unread visible announcements — for a nav badge. */
export const unreadAnnouncements = cache(async (user: SessionUser) => {
  const list = await visibleAnnouncements(user);
  return list.filter((a) => !a.read).length;
});

/** Every announcement (published + drafts) for the author view. */
export const allAnnouncements = cache(async () =>
  prisma.announcement.findMany({
    include: annInclude,
    orderBy: [{ isPublished: "asc" }, { publishAt: "desc" }],
  }),
);
