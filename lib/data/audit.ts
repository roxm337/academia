import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const AUDIT_PAGE_SIZE = 50;

/** One page of the audit log, newest first, optionally filtered by entity. */
export const listAudit = cache(async (entity: string | null, page: number) => {
  const where = entity ? { entity } : {};
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total };
});

/** The distinct entity types present, for the filter dropdown. */
export const auditEntities = cache(async () => {
  const rows = await prisma.auditLog.findMany({
    distinct: ["entity"],
    select: { entity: true },
    orderBy: { entity: "asc" },
  });
  return rows.map((r) => r.entity);
});
