import "server-only";

import { prisma } from "@/lib/prisma";
import { isEmailConfigured, renderEmail, sendMail } from "@/lib/email";
import type {
  NotificationChannel as Channel,
  NotificationStatus,
} from "@/lib/generated/prisma/enums";

/**
 * Notification delivery, behind a channel abstraction so the rest of the app
 * says "tell this parent their child was absent" without caring whether that
 * goes in-app, by e-mail, SMS or WhatsApp.
 *
 * IN_APP and EMAIL deliver for real. SMS and WHATSAPP are still stubs that
 * record intent — see pendingDriver for why they must not claim to have sent.
 */

export type OutboundNotification = {
  userId: string;
  type: string; // "ABSENCE_ALERT" | "JUSTIFICATION_REVIEWED" | ...
  titleAr: string;
  titleFr: string;
  bodyAr: string;
  bodyFr: string;
  link?: string;
  /** One row per channel. Defaults to in-app only. */
  channels?: Channel[];
};

type DeliveryResult = { status: NotificationStatus; error?: string };

interface ChannelDriver {
  deliver(n: OutboundNotification & { channel: Channel }): Promise<DeliveryResult>;
}

/** In-app: the persisted Notification row *is* the delivery. */
const inAppDriver: ChannelDriver = {
  async deliver() {
    return { status: "SENT" };
  },
};

/**
 * E-mail, in the recipient's own language.
 *
 * A parent who reads Arabic gets the Arabic body in an RTL document; the same
 * alert to a French-reading guardian goes out in French. Both come from the
 * one Notification row, which already carries both translations.
 */
const emailDriver: ChannelDriver = {
  async deliver(n) {
    if (!isEmailConfigured()) {
      console.info(`[notifications] SMTP not configured; left PENDING: ${n.type}`);
      return { status: "PENDING" };
    }

    const user = await prisma.user.findUnique({
      where: { id: n.userId },
      select: { email: true, locale: true },
    });
    if (!user?.email) return { status: "FAILED", error: "no email address" };

    const arabic = user.locale === "ar";
    const settings = await prisma.schoolSettings.findFirst({
      select: { nameAr: true, nameFr: true },
    });

    const { html, text } = renderEmail({
      locale: user.locale,
      title: arabic ? n.titleAr : n.titleFr,
      body: arabic ? n.bodyAr : n.bodyFr,
      url: absoluteUrl(n.link, user.locale),
      actionLabel: arabic ? "فتح المنصة" : "Ouvrir la plateforme",
      schoolName: (arabic ? settings?.nameAr : settings?.nameFr) ?? "",
    });

    try {
      await sendMail({
        to: user.email,
        subject: arabic ? n.titleAr : n.titleFr,
        text,
        html,
        locale: user.locale,
      });
      return { status: "SENT" };
    } catch (e) {
      // Recorded, not thrown: one unreachable mail server must not roll back
      // the attendance save that triggered the alert.
      const error = e instanceof Error ? e.message : String(e);
      console.error(`[notifications] email failed for ${n.type}: ${error}`);
      return { status: "FAILED", error: error.slice(0, 500) };
    }
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
  if (channel === "IN_APP") return inAppDriver;
  if (channel === "EMAIL") return emailDriver;
  return pendingDriver;
}

/** In-app links are relative; an e-mail needs the whole address. */
function absoluteUrl(link: string | undefined, locale: string): string | undefined {
  if (!link) return undefined;
  const base = process.env.APP_URL ?? process.env.AUTH_URL;
  if (!base) return undefined;
  return `${base.replace(/\/$/, "")}/${locale}${link}`;
}

/**
 * Persist and dispatch one notification, once per requested channel. Always
 * writes the row first (so an in-app bell shows it even if e-mail later
 * fails), then records the delivery outcome against that row.
 */
export async function notify(input: OutboundNotification) {
  const channels = input.channels?.length ? [...new Set(input.channels)] : (["IN_APP"] as Channel[]);

  return Promise.all(
    channels.map(async (channel) => {
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
    }),
  );
}

/** Fan a single notification out to several users (e.g. all of a child's guardians). */
export async function notifyMany(
  userIds: string[],
  base: Omit<OutboundNotification, "userId">,
) {
  const unique = [...new Set(userIds)];
  const results = await Promise.all(unique.map((userId) => notify({ ...base, userId })));
  return results.flat();
}
