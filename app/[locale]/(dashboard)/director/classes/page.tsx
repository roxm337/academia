import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import {
  Badge, Card, Table, TableWrap, Td, Th,
} from "@/components/ui/field";
import {
  ClassForm, LevelForm, SpecialityForm,
} from "@/components/director/structure-forms";
import { DeleteForm } from "@/components/director/delete-form";
import { requireRole } from "@/lib/dal";
import { deleteClass, deleteLevel } from "@/lib/actions/structure";
import { listClasses, listCycles, listLevels } from "@/lib/data/structure";
import { prisma } from "@/lib/prisma";
import { localized } from "@/lib/school";

export default async function ClassesPage({
  params,
}: PageProps<"/[locale]/director/classes">) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireRole("DIRECTOR");
  const t = await getTranslations("director.classes");
  const tc = await getTranslations("director.common");

  const [classes, cycles, levels, teachers] = await Promise.all([
    listClasses(),
    listCycles(),
    listLevels(),
    prisma.teacherProfile.findMany({
      include: { user: true },
      orderBy: { user: { lastNameFr: "asc" } },
    }),
  ]);

  const levelOptions = levels.map((l) => ({
    id: l.id,
    label: `${l.code} — ${localized(l, locale)}`,
  }));
  const cycleOptions = cycles.map((c) => ({
    id: c.id,
    label: localized(c, locale),
  }));
  const teacherOptions = teachers.map((tp) => ({
    id: tp.id,
    label:
      locale === "ar"
        ? `${tp.user.firstNameAr} ${tp.user.lastNameAr}`
        : `${tp.user.firstNameFr} ${tp.user.lastNameFr}`,
  }));
  const streamsByLevel: Record<string, { id: string; label: string }[]> = {};
  for (const l of levels) {
    streamsByLevel[l.id] = l.specialities.map((s) => ({
      id: s.id,
      label: `${l.code} · ${localized(s, locale)}`,
    }));
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ClassForm
          levels={levelOptions}
          teachers={teacherOptions}
        />
        <LevelForm cycles={cycleOptions} />
        <SpecialityForm levels={levelOptions} />
      </div>

      {classes.length === 0 ? (
        <Card className="text-center text-sm text-[var(--muted)]">
          {t("emptyClasses")}
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("className")}</Th>
                <Th>{t("level")}</Th>
                <Th>{t("mainTeacher")}</Th>
                <Th>{t("students")}</Th>
                <Th className="text-end">{tc("actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {classes.map((k) => (
                <tr key={k.id}>
                  <Td className="font-medium">{k.name}</Td>
                  <Td>{localized(k.level, locale)}</Td>
                  <Td>
                    {k.mainTeacher ? (
                      locale === "ar"
                        ? `${k.mainTeacher.user.firstNameAr} ${k.mainTeacher.user.lastNameAr}`
                        : `${k.mainTeacher.user.firstNameFr} ${k.mainTeacher.user.lastNameFr}`
                    ) : (
                      <span className="text-[var(--muted)]">{tc("none")}</span>
                    )}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        k.capacity && k._count.enrollments >= k.capacity
                          ? "warn"
                          : "neutral"
                      }
                    >
                      {k._count.enrollments}
                      {k.capacity ? ` / ${k.capacity}` : ""}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <ClassForm
                        levels={levelOptions}
                        teachers={teacherOptions}
                        klass={{
                          id: k.id,
                          name: k.name,
                          levelId: k.levelId,
                          capacity: k.capacity,
                          mainTeacherId: k.mainTeacherId,
                        }}
                      />
                      <DeleteForm action={deleteClass} id={k.id} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {/* ---------------------------------------------------- levels & streams */}
      <h2 className="mt-10 mb-3 text-lg font-semibold">{t("structure")}</h2>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>{t("code")}</Th>
              <Th>{t("level")}</Th>
              <Th>{t("cycle")}</Th>
              <Th>{t("stream")}</Th>
              <Th className="text-end">{tc("actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.id}>
                <Td className="font-mono text-xs">{l.code}</Td>
                <Td>{localized(l, locale)}</Td>
                <Td className="text-[var(--muted)]">
                  {localized(l.cycle, locale)}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {l.specialities.length === 0 ? (
                      <span className="text-[var(--muted)]">{tc("none")}</span>
                    ) : (
                      l.specialities.map((s) => (
                        <Badge key={s.id}>{localized(s, locale)}</Badge>
                      ))
                    )}
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <LevelForm
                      cycles={cycleOptions}
                      level={{
                        id: l.id,
                        cycleId: l.cycleId,
                        code: l.code,
                        nameAr: l.nameAr,
                        nameFr: l.nameFr,
                        order: l.order,
                      }}
                    />
                    <DeleteForm action={deleteLevel} id={l.id} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
