"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

/**
 * Mark the caller's notifications read. Scoped to their own rows — a user can
 * never touch someone else's. Called from the notifications centre once it's on
 * screen, so it takes no arguments and clears the lot.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const user = await verifySession();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/[locale]/(dashboard)/notifications", "page");
}
