import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { IncidentModal } from "@/components/vie/incident-form";
import { DeleteForm } from "@/components/director/delete-form";
import { requireRole } from "@/lib/dal";
import { deleteIncident } from "@/lib/actions/discipline";
import { listIncidents } from "@/lib/data/attendance";
import { listClassesLite } from "@/lib/data/timetable";
import { prisma } from "@/lib/prisma";

export default async function Page({
  params,
}: PageProps<"/[locale]/surveillant/discipline">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireRole("SURVEILLANT", "DIRECTOR");

  const t = await getTranslations("vie.discipline");
  const tt = await getTranslations("vie.types");
  const ts = await getTranslations("vie.sanctions");

  const [incidents, classes, students] = await Promise.all([
    listIncidents(),
    listClassesLite(),
    prisma.studentProfile.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true, codeMassar: true,
        user: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true } },
      },
      orderBy: { user: { lastNameFr: "asc" } },
      take: 1000,
    }),
  ]);

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  const studentOpts = students.map((s) => ({ id: s.id, label: `${s.codeMassar} · ${name(s.user)}` }));
  const classOpts = classes.map((c) => ({ id: c.id, label: c.name }));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4">
        <IncidentModal students={studentOpts} classes={classOpts} />
      </div>

      {incidents.length === 0 ? (
        <Card className="text-sm text-[var(--muted)]">{t("none")}</Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("occurredAt")}</Th>
                <Th>{t("student")}</Th>
                <Th>{t("type")}</Th>
                <Th>{t("sanction")}</Th>
                <Th>{t("description")}</Th>
                <Th>{t("reportedBy")}</Th>
                {actor.role === "DIRECTOR" ? <Th className="text-end" /> : null}
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <Td className="whitespace-nowrap font-mono text-xs">{dateStr(i.occurredAt)}</Td>
                  <Td className="whitespace-nowrap font-medium">{name(i.student.user)}</Td>
                  <Td>{tt(i.type)}</Td>
                  <Td>
                    {i.sanction === "NONE" ? (
                      <span className="text-[var(--muted)]">—</span>
                    ) : (
                      <Badge tone="warn">{ts(i.sanction)}</Badge>
                    )}
                  </Td>
                  <Td className="max-w-xs truncate">{i.description}</Td>
                  <Td className="whitespace-nowrap text-xs text-[var(--muted)]">
                    {i.reportedBy ? name(i.reportedBy) : "—"}
                  </Td>
                  {actor.role === "DIRECTOR" ? (
                    <Td>
                      <div className="flex justify-end gap-1">
                        <IncidentModal
                          students={studentOpts}
                          classes={classOpts}
                          incident={{
                            id: i.id,
                            studentId: i.studentId,
                            classId: i.classId,
                            type: i.type,
                            sanction: i.sanction,
                            description: i.description,
                            occurredAt: dateStr(i.occurredAt),
                            exclusionFrom: i.exclusionFrom ? dateStr(i.exclusionFrom) : null,
                            exclusionTo: i.exclusionTo ? dateStr(i.exclusionTo) : null,
                          }}
                        />
                        <DeleteForm action={deleteIncident} id={i.id} />
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
