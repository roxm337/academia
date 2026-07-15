import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** A user's notifications, newest first. */
export const myNotifications = cache(async (userId: string, take = 50) =>
  prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  }),
);

/** How many the user hasn't read yet — for the header bell badge. */
export const unreadNotificationCount = cache(async (userId: string) =>
  prisma.notification.count({ where: { userId, readAt: null } }),
);
