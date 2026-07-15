import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { PaymentModal, DiscountModal, GenerateScheduleForm } from "@/components/fees/fee-forms";
import { studentSchedule } from "@/lib/data/fees";
import { formatMAD } from "@/lib/fees";
import { localized } from "@/lib/school";

const STATUS_TONE = { PAID: "success", PARTIAL: "warn", OVERDUE: "danger", PENDING: "neutral" } as const;

/**
 * A student's fee schedule: totals, installments and payments (with receipt
 * links). `manage` unlocks the director's actions (record payment, set discount);
 * parents see the same numbers read-only.
 */
export async function StudentFeeView({
  studentId,
  locale,
  manage,
}: {
  studentId: string;
  locale: string;
  manage: boolean;
}) {
  const t = await getTranslations("fees");
  const data = await studentSchedule(studentId);

  if (!data) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <span>{t("noSchedule")}</span>
        {manage ? <GenerateScheduleForm studentId={studentId} /> : null}
      </Card>
    );
  }

  const { schedule, installments, payments, summary, discount } = data;
  const money = (n: number) => formatMAD(n, locale);
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-[var(--muted)]">{t("net")}</div><div className="font-semibold">{money(summary.net)}</div></Card>
        <Card><div className="text-xs text-[var(--muted)]">{t("discount")}</div><div className="font-semibold">{money(summary.discount)}</div></Card>
        <Card><div className="text-xs text-[var(--muted)]">{t("paid")}</div><div className="font-semibold text-emerald-700">{money(summary.paid)}</div></Card>
        <Card><div className="text-xs text-[var(--muted)]">{t("balance")}</div><div className={`font-semibold ${summary.balance > 0 ? "text-red-700" : "text-emerald-700"}`}>{money(summary.balance)}</div></Card>
      </div>

      {manage ? (
        <div className="flex flex-wrap items-center gap-2">
          <PaymentModal studentId={studentId} />
          <DiscountModal
            scheduleId={schedule.id}
            sibling={Number(schedule.siblingDiscount)}
            custom={Number(schedule.customDiscount)}
            note={schedule.discountNote ?? ""}
          />
        </div>
      ) : null}

      {/* Installments */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("installments")}</h2>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("installment")}</Th>
                <Th>{t("dueDate")}</Th>
                <Th className="text-end">{t("amount")}</Th>
                <Th className="text-end">{t("paid")}</Th>
                <Th>{t("status")}</Th>
              </tr>
            </thead>
            <tbody>
              {installments.map((i) => (
                <tr key={i.id}>
                  <Td>{localized(i.feeItem, locale)}{i.label ? ` — ${i.label}` : ""}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{dateStr(i.dueDate)}</Td>
                  <Td className="text-end font-mono">{money(i.amountNum)}</Td>
                  <Td className="text-end font-mono">{money(i.amountPaidNum)}</Td>
                  <Td><Badge tone={STATUS_TONE[i.computedStatus]}>{t(`statuses.${i.computedStatus}`)}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {discount > 0 && schedule.discountNote ? (
          <p className="mt-2 text-xs text-[var(--muted)]">{t("discount")}: {schedule.discountNote}</p>
        ) : null}
      </section>

      {/* Payments */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("payments")}</h2>
        {payments.length === 0 ? (
          <Card className="text-sm text-[var(--muted)]">—</Card>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t("paidOn")}</Th>
                  <Th className="text-end">{t("amount")}</Th>
                  <Th>{t("method")}</Th>
                  <Th>{t("reference")}</Th>
                  <Th className="text-end">{t("receipt")}</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap font-mono text-xs">{dateStr(p.paidAt)}</Td>
                    <Td className="text-end font-mono">{money(Number(p.amount))}</Td>
                    <Td>{t(`methods.${p.method}`)}</Td>
                    <Td className="text-xs text-[var(--muted)]">{p.reference ?? "—"}</Td>
                    <Td>
                      <div className="flex justify-end">
                        {p.receipt ? (
                          <a href={`/api/receipt/pdf?id=${p.receipt.id}&locale=${locale}`} target="_blank" rel="noopener"
                            className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline">
                            <FileText className="size-3.5" />{t("receiptNo")} {p.receipt.number}
                          </a>
                        ) : "—"}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>
    </div>
  );
}
