"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { dayStart, parseDay } from "@/lib/data/attendance";
import type { ActionState } from "@/lib/actions/structure";

const incidentSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1),
  classId: z.string().optional(),
  type: z.enum([
    "BEHAVIOUR", "VIOLENCE", "CHEATING", "TARDINESS", "MATERIAL_DAMAGE", "OTHER",
  ]),
  description: z.string().trim().min(3).max(1000),
  sanction: z.enum([
    "NONE", "AVERTISSEMENT", "BLAME", "EXCLUSION_TEMPORAIRE", "CONSEIL_DISCIPLINE",
  ]),
  occurredAt: z.string().min(1),
  exclusionFrom: z.string().optional(),
  exclusionTo: z.string().optional(),
});

/** Only staff who witness school life may log an incident. */
function canReport(role: string) {
  return role === "SURVEILLANT" || role === "TEACHER" || role === "DIRECTOR";
}

export async function saveIncident(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  if (!canReport(actor.role)) return { error: "notAllowed" };

  const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const occurredAt = parseDay(d.occurredAt);
  if (!occurredAt) return { error: "invalid" };
  const exclusionFrom = d.exclusionFrom ? parseDay(d.exclusionFrom) : null;
  const exclusionTo = d.exclusionTo ? parseDay(d.exclusionTo) : null;

  const data = {
    studentId: d.studentId,
    classId: d.classId || null,
    type: d.type,
    description: d.description,
    sanction: d.sanction,
    occurredAt: dayStart(occurredAt),
    exclusionFrom: exclusionFrom ? dayStart(exclusionFrom) : null,
    exclusionTo: exclusionTo ? dayStart(exclusionTo) : null,
  };

  const before = d.id
    ? await prisma.disciplineIncident.findUnique({ where: { id: d.id } })
    : null;
  // An edit stays with its original reporter; only a new one is stamped with the actor.
  if (d.id && !before) return { error: "notFound" };

  const incident = d.id
    ? await prisma.disciplineIncident.update({ where: { id: d.id }, data })
    : await prisma.disciplineIncident.create({
        data: { ...data, reportedById: actor.id },
      });

  // Notify guardians on a new incident (edits don't re-alert).
  if (!d.id) {
    const student = await prisma.studentProfile.findUnique({
      where: { id: d.studentId },
      select: { guardians: { select: { guardian: { select: { userId: true } } } } },
    });
    const ids = (student?.guardians ?? [])
      .map((g) => g.guardian.userId)
      .filter((x): x is string => Boolean(x));
    if (ids.length) {
      await notifyMany(ids, {
        type: "DISCIPLINE_INCIDENT",
        titleAr: "إشعار سلوكي",
        titleFr: "Incident disciplinaire",
        bodyAr: "تم تسجيل حادث انضباطي يخص ابنكم/ابنتكم.",
        bodyFr: "Un incident disciplinaire a été enregistré concernant votre enfant.",
        link: "/parent/attendance",
      });
    }
  }

  await audit({
    actorId: actor.id,
    action: d.id ? "INCIDENT_UPDATE" : "INCIDENT_CREATE",
    entity: "DisciplineIncident",
    entityId: incident.id,
    before,
    after: incident,
  });

  revalidatePath("/[locale]/(dashboard)/surveillant/discipline", "page");
  return { ok: true };
}

export async function deleteIncident(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  // Deleting a disciplinary record is a director call, not a surveillant's.
  if (actor.role !== "DIRECTOR") return { error: "notAllowed" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  const before = await prisma.disciplineIncident.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };
  await prisma.disciplineIncident.delete({ where: { id } });

  await audit({
    actorId: actor.id,
    action: "INCIDENT_DELETE",
    entity: "DisciplineIncident",
    entityId: id,
    before,
  });

  revalidatePath("/[locale]/(dashboard)/surveillant/discipline", "page");
  return { ok: true };
}
