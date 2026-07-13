import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Every write that a human would want to contest later goes through here:
 * who changed what, when, and from what to what. The brief requires a full
 * audit trail for grade changes; the same trail is cheap for everything else.
 */
export async function audit(params: {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  const h = await headers();

  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      before: serialize(params.before),
      after: serialize(params.after),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    },
  });
}

/** Prisma Decimal/Date don't survive JSON round-trips as-is. */
function serialize(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );
}
