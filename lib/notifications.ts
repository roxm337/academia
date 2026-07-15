import "server-only";

import { prisma } from "@/lib/prisma";
import type {
  NotificationChannel as Channel,
  NotificationStatus,
} from "@/lib/generated/prisma/enums";

/**
 * Notification delivery, behind a channel abstraction so the rest of the app
 * says "tell this parent their child was absent" without caring whether that
 * goes in-app, by e-mail, SMS or WhatsApp. Phase 1 delivers IN_APP for real;
 * the other channels are stubs that record intent (status stays PENDING) until
 * a provider is wired in — the brief asks for the seam, not the SMS contract.
 */

export type OutboundNotification = {
  userId: string;
  type: string; // "ABSENCE_ALERT" | "JUSTIFICATION_REVIEWED" | ...
  titleAr: string;
  titleFr: string;
  bodyAr: string;
  bodyFr: string;
  link?: string;
  channel?: Channel;
};

type DeliveryResult = { status: NotificationStatus; error?: string };

interface ChannelDriver {
  deliver(n: OutboundNotification): Promise<DeliveryResult>;
}

/** In-app: the persisted Notification row *is* the delivery. */
const inAppDriver: ChannelDriver = {
  async deliver() {
    return { status: "SENT" };
  },
};

/**
 * Not-yet-integrated channels. They must never pretend to have sent: a stub
 * that returned SENT would make the UI show "parent notified by SMS" when no
 * SMS left the building. So they leave the row PENDING for a future worker to
 * pick up once a provider exists.
 */
const pendingDriver: ChannelDriver = {
  async deliver(n) {
    console.info(`[notifications] ${n.channel} not configured; left PENDING: ${n.type}`);
    return { status: "PENDING" };
  },
};

function driverFor(channel: Channel): ChannelDriver {
  return channel === "IN_APP" ? inAppDriver : pendingDriver;
}

/**
 * Persist and dispatch one notification. Always writes the row first (so an
 * in-app bell shows it even if an external channel later fails), then records
 * the delivery outcome.
 */
export async function notify(input: OutboundNotification) {
  const channel: Channel = input.channel ?? "IN_APP";

  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      titleAr: input.titleAr,
      titleFr: input.titleFr,
      bodyAr: input.bodyAr,
      bodyFr: input.bodyFr,
      link: input.link ?? null,
      channel,
      status: "PENDING",
    },
  });

  const result = await driverFor(channel).deliver({ ...input, channel });

  return prisma.notification.update({
    where: { id: row.id },
    data: {
      status: result.status,
      error: result.error ?? null,
      sentAt: result.status === "SENT" ? new Date() : null,
    },
  });
}

/** Fan a single notification out to several users (e.g. all of a child's guardians). */
export async function notifyMany(
  userIds: string[],
  base: Omit<OutboundNotification, "userId">,
) {
  const unique = [...new Set(userIds)];
  return Promise.all(unique.map((userId) => notify({ ...base, userId })));
}
