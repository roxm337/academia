"use client";

import { useEffect } from "react";
import { markAnnouncementsRead } from "@/lib/actions/announcements";
import { markThreadRead } from "@/lib/actions/messaging";
import { markAllNotificationsRead } from "@/lib/actions/notifications";

/**
 * Records read receipts once the content is on screen. This runs in an effect,
 * not during render — marking-read is a side effect and must not happen while
 * rendering the page.
 */
export function MarkAnnouncementsRead({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (ids.length) markAnnouncementsRead(ids);
    // Fire once for this set of unread ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);
  return null;
}

export function MarkThreadRead({ threadId }: { threadId: string }) {
  useEffect(() => {
    markThreadRead(threadId);
  }, [threadId]);
  return null;
}

/** Clears the caller's unread notifications once the centre is on screen. */
export function MarkAllNotificationsRead({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (hasUnread) markAllNotificationsRead();
  }, [hasUnread]);
  return null;
}
