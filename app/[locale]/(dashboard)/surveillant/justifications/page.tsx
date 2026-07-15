import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { ReviewJustification } from "@/components/vie/justification-forms";
import { requireRole } from "@/lib/dal";
import { listJustifications } from "@/lib/data/attendance";

const TONE = { PENDING: "warn", APPROVED: "success", REJECTED: "danger" } as const;

export default async function Page({
  params,
}: PageProps<"/[locale]/surveillant/justifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SURVEILLANT", "DIRECTOR");

  const t = await getTranslations("vie.justifications");
  const rows = await listJustifications();

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {rows.length === 0 ? (
        <Card className="text-sm text-[var(--muted)]">{t("none")}</Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("child")}</Th>
                <Th>{t("from")}</Th>
                <Th>{t("to")}</Th>
                <Th>{t("reason")}</Th>
                <Th>{t("status")}</Th>
                <Th className="text-end">{t("review")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id}>
                  <Td className="whitespace-nowrap font-medium">{name(j.student.user)}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{dateStr(j.fromDate)}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{dateStr(j.toDate)}</Td>
                  <Td className="max-w-xs truncate">{j.reason}</Td>
                  <Td>
                    <Badge tone={TONE[j.status]}>{t(j.status.toLowerCase())}</Badge>
                    {j.reviewedBy ? (
                      <span className="ms-2 text-xs text-[var(--muted)]">
                        {t("reviewedBy")} {name(j.reviewedBy)}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      {j.status === "PENDING" ? <ReviewJustification id={j.id} /> : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
