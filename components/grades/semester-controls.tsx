"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Lock, LockOpen, Eye, EyeOff } from "lucide-react";
import { lockSemester, publishSemester } from "@/lib/actions/semester";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/field";

/** Director's lock + publish toggles for one semester. */
export function SemesterControls({
  semesterId,
  isLocked,
  isPublished,
}: {
  semesterId: string;
  isLocked: boolean;
  isPublished: boolean;
}) {
  const t = useTranslations("grades");
  const [, lockAction, lockPending] = useActionState<ActionState, FormData>(lockSemester, null);
  const [, pubAction, pubPending] = useActionState<ActionState, FormData>(publishSemester, null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={isLocked ? "warn" : "neutral"}>
        {isLocked ? t("locked") : t("unlocked")}
      </Badge>
      <Badge tone={isPublished ? "success" : "neutral"}>
        {isPublished ? t("published") : t("notPublished")}
      </Badge>

      <form action={lockAction}>
        <input type="hidden" name="id" value={semesterId} />
        <input type="hidden" name="value" value={isLocked ? "false" : "true"} />
        <Button type="submit" variant="outline" size="sm" disabled={lockPending}>
          {isLocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
          {isLocked ? t("unlock") : t("lock")}
        </Button>
      </form>

      <form action={pubAction}>
        <input type="hidden" name="id" value={semesterId} />
        <input type="hidden" name="value" value={isPublished ? "false" : "true"} />
        <Button type="submit" variant="outline" size="sm" disabled={pubPending}>
          {isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {isPublished ? t("unpublish") : t("publish")}
        </Button>
      </form>
    </div>
  );
}
