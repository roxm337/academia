/**
 * Announcement visibility — pure and client-safe, so "who is this announcement
 * for?" has one answer shared by the reader feed, the unread badge and the
 * tests.
 */

import type { Role } from "@/lib/generated/prisma/enums";

export type Audience =
  | "WHOLE_SCHOOL"
  | "CYCLE"
  | "LEVEL"
  | "CLASS"
  | "TEACHERS"
  | "PARENTS";

export type AnnouncementTarget = {
  audience: Audience;
  cycleId?: string | null;
  levelId?: string | null;
  classId?: string | null;
};

/**
 * A viewer's reach: their role, and the classes/levels/cycles they belong to
 * (a student's own class; a parent's children's classes; a teacher's taught
 * classes). Built once from the DB, then matched against each announcement.
 */
export type ViewerContext = {
  role: Role;
  classIds: Set<string>;
  levelIds: Set<string>;
  cycleIds: Set<string>;
};

/**
 * Whether this viewer is in the announcement's audience.
 *
 * Staff who manage announcements (director, surveillant) are handled separately
 * — they see every announcement in their authoring view, so they are not passed
 * through this matcher.
 */
export function canSeeAnnouncement(
  a: AnnouncementTarget,
  ctx: ViewerContext,
): boolean {
  switch (a.audience) {
    case "WHOLE_SCHOOL":
      return true;
    case "TEACHERS":
      return ctx.role === "TEACHER";
    case "PARENTS":
      return ctx.role === "PARENT";
    case "CLASS":
      return a.classId != null && ctx.classIds.has(a.classId);
    case "LEVEL":
      return a.levelId != null && ctx.levelIds.has(a.levelId);
    case "CYCLE":
      return a.cycleId != null && ctx.cycleIds.has(a.cycleId);
    default:
      return false;
  }
}

/** Audiences that need a specific target id — validated when authoring. */
export function audienceNeedsTarget(audience: Audience): "cycle" | "level" | "class" | null {
  if (audience === "CYCLE") return "cycle";
  if (audience === "LEVEL") return "level";
  if (audience === "CLASS") return "class";
  return null;
}
