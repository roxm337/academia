"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/structure";

const toggleSchema = z.object({
  id: z.string().min(1),
  value: z.enum(["true", "false"]),
});

/**
 * Lock or unlock a semester. A locked semester freezes its gradebook — no item,
 * score or appreciation can change — so a bulletin can't shift under a family
 * after it's been handed out.
 */
export async function lockSemester(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const lock = parsed.data.value === "true";
  const updated = await prisma.semester.update({
    where: { id: parsed.data.id },
    data: { isLocked: lock, lockedAt: lock ? new Date() : null },
  });

  await audit({
    actorId: actor.id,
    action: lock ? "SEMESTER_LOCK" : "SEMESTER_UNLOCK",
    entity: "Semester",
    entityId: updated.id,
  });

  revalidatePath("/[locale]/(dashboard)/director/grades", "page");
  return { ok: true };
}

/**
 * Publish (or hide) a semester's grades. Until published, students and parents
 * see nothing — grade entry happens out of their view, and the school controls
 * the moment results become visible.
 */
export async function publishSemester(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const publish = parsed.data.value === "true";
  const updated = await prisma.semester.update({
    where: { id: parsed.data.id },
    data: { gradesPublishedAt: publish ? new Date() : null },
  });

  await audit({
    actorId: actor.id,
    action: publish ? "GRADES_PUBLISH" : "GRADES_UNPUBLISH",
    entity: "Semester",
    entityId: updated.id,
  });

  revalidatePath("/[locale]/(dashboard)/director/grades", "page");
  return { ok: true };
}
