"use client";

import { useEffect } from "react";
import { markAnnouncementsRead } from "@/lib/actions/announcements";
import { markThreadRead } from "@/lib/actions/messaging";
import { markAllNotificationsRead } from "@/lib/actions/notifications";

/**
 * Records read receipts once the content is on screen. This runs in an effect,
 * not during render — marking-read is a side effect and must not happen while
 * rendering the page.
 *
 * Every call is fire-and-forget and **must not be able to break the page**. A
 * receipt is bookkeeping: if it fails, the reader still read the thing, and the
 * worst outcome is an item staying bold. Without the catch, a rejected action
 * becomes an unhandledRejection and takes the whole route down with it.
 */
function fireAndForget(run: () => Promise<unknown>, what: string) {
  void run().catch((e) => {
    console.error(`[read-receipt] ${what} failed`, e);
  });
}

export function MarkAnnouncementsRead({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (ids.length) fireAndForget(() => markAnnouncementsRead(ids), "announcements");
    // Fire once for this set of unread ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);
  return null;
}

export function MarkThreadRead({ threadId }: { threadId: string }) {
  useEffect(() => {
    fireAndForget(() => markThreadRead(threadId), "thread");
  }, [threadId]);
  return null;
}

/** Clears the caller's unread notifications once the centre is on screen. */
export function MarkAllNotificationsRead({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (hasUnread) fireAndForget(() => markAllNotificationsRead(), "notifications");
  }, [hasUnread]);
  return null;
}
