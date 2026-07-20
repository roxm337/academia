import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { ReceiptBookletForm } from "@/components/fees/receipt-booklet-form";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { FeeItemModal, GenerateClassForm, GenerateScheduleForm, PaymentModal, RemindersForm } from "@/components/fees/fee-forms";
import { ClassPicker } from "@/components/fees/class-picker";
import { DeleteForm } from "@/components/director/delete-form";
import { requireRole } from "@/lib/dal";
import { deleteFeeItem } from "@/lib/actions/fees";
import { listFeeItems, classFeeOverview } from "@/lib/data/fees";
import { listLevels } from "@/lib/data/structure";
import { listClassesLite } from "@/lib/data/timetable";
import { localized } from "@/lib/school";
import { formatMAD } from "@/lib/fees";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/director/fees">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("DIRECTOR");

  const t = await getTranslations("fees");
  const sp = await searchParams;
  const [feeItems, levels, classes] = await Promise.all([listFeeItems(), listLevels(), listClassesLite()]);

  const levelOpts = levels.map((l) => ({ id: l.id, label: `${l.code} — ${localized(l, locale)}` }));
  const classId = classes.some((c) => c.id === sp.class) ? String(sp.class) : (classes[0]?.id ?? "");
  const overview = classId ? await classFeeOverview(classId) : [];

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;
  const money = (n: number) => formatMAD(n, locale);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <ReceiptBookletForm classes={classes.map((c) => ({ id: c.id, name: c.name }))} />

      {/* Fee items */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("feeItems")}</h2>
          <FeeItemModal levels={levelOpts} />
        </div>
        {feeItems.length === 0 ? (
          <Card className="text-sm text-[var(--muted)]">{t("noItems")}</Card>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t("kind")}</Th><Th>{t("name")}</Th><Th>{t("level")}</Th>
                  <Th className="text-end">{t("amount")}</Th><Th>{t("monthly")}</Th><Th className="text-end" />
                </tr>
              </thead>
              <tbody>
                {feeItems.map((f) => (
                  <tr key={f.id}>
                    <Td>{t(`kinds.${f.kind}`)}</Td>
                    <Td className="font-medium">{localized(f, locale)}</Td>
                    <Td>{f.level ? localized(f.level, locale) : t("allLevels")}</Td>
                    <Td className="text-end font-mono">{money(Number(f.amount))}</Td>
                    <Td>{f.isMonthly ? <Badge tone="neutral">{t("monthly")}</Badge> : "—"}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <FeeItemModal levels={levelOpts} item={{ id: f.id, levelId: f.levelId, kind: f.kind, nameAr: f.nameAr, nameFr: f.nameFr, amount: Number(f.amount), isMonthly: f.isMonthly }} />
                        <DeleteForm action={deleteFeeItem} id={f.id} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      {/* Class balances */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("students")}</h2>
          <div className="flex flex-wrap items-end gap-3">
            {classes.length ? <ClassPicker classes={classes} classId={classId} /> : null}
            {classId ? <GenerateClassForm classId={classId} /> : null}
            <RemindersForm />
          </div>
        </div>

        {classes.length === 0 ? (
          <EmptyState message={t("noClass")} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t("student")}</Th>
                  <Th className="text-end">{t("net")}</Th>
                  <Th className="text-end">{t("paid")}</Th>
                  <Th className="text-end">{t("balance")}</Th>
                  <Th className="text-end" />
                </tr>
              </thead>
              <tbody>
                {overview.map((o) => (
                  <tr key={o.student.id}>
                    <Td className="whitespace-nowrap font-medium">{name(o.student.user)}</Td>
                    <Td className="text-end font-mono">{o.summary ? money(o.summary.net) : "—"}</Td>
                    <Td className="text-end font-mono">{o.summary ? money(o.summary.paid) : "—"}</Td>
                    <Td className="text-end font-mono">
                      {o.summary ? (
                        <span className={o.summary.balance > 0 ? "text-red-700" : "text-emerald-700"}>{money(o.summary.balance)}</span>
                      ) : "—"}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {o.hasSchedule ? (
                          <>
                            <PaymentModal studentId={o.student.id} />
                            <Link href={`/director/fees/${o.student.id}`} className="inline-flex items-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-black/[0.03]">
                              {t("detail")}
                            </Link>
                          </>
                        ) : (
                          <GenerateScheduleForm studentId={o.student.id} />
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>
    </>
  );
}
