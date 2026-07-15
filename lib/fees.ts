/**
 * Fees & payments — pure, client-safe money logic. Amounts are MAD with 2
 * decimals; every rounding happens here so a dirham never appears or vanishes
 * between the schedule, a receipt and the tests.
 *
 * Money is handled in whole centimes internally for the allocation maths (float
 * addition of 0.10 + 0.20 ≠ 0.30 would misallocate a payment), then converted
 * back to a 2-decimal number at the boundary.
 */

export type InstallmentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
export type FeeKind =
  | "INSCRIPTION" | "TUITION" | "TRANSPORT" | "CANTINE" | "INSURANCE" | "BOOKS" | "OTHER";

const cents = (mad: number) => Math.round(mad * 100);
const mad = (c: number) => Math.round(c) / 100;

/** Round a MAD amount to 2 decimals. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** "1 500,00 MAD" / "1 500,00 د.م." — grouped, 2 decimals, localized separator. */
export function formatMAD(amount: number, locale: string): string {
  const fixed = amount.toFixed(2);
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " "); // group thousands
  const unit = locale === "ar" ? "د.م." : "MAD";
  return `${grouped},${dec} ${unit}`;
}

/**
 * First-of-month UTC dates from `start`'s month through `end`'s month,
 * inclusive — the months a monthly (mensualité) fee is billed across.
 */
export function monthsBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  const endY = end.getUTCFullYear();
  const endM = end.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    out.push(new Date(Date.UTC(y, m, 1)));
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

export type FeeItemLike = {
  id: string;
  isMonthly: boolean;
  amount: number;
  nameAr: string;
  nameFr: string;
};

export type PlannedInstallment = {
  feeItemId: string;
  labelAr: string;
  labelFr: string;
  dueDate: Date;
  amount: number;
};

/**
 * Gross installment plan for a student: each monthly fee becomes one
 * installment per school-year month (due on the 5th), each one-off fee a single
 * installment due at the start. Discounts are NOT baked in here — they're a
 * schedule-level credit, so this plan stays stable when a discount changes.
 */
export function buildInstallmentPlan(
  items: FeeItemLike[],
  yearStart: Date,
  yearEnd: Date,
): PlannedInstallment[] {
  const months = monthsBetween(yearStart, yearEnd);
  const plan: PlannedInstallment[] = [];

  for (const item of items) {
    if (item.isMonthly) {
      for (const m of months) {
        const due = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 5));
        const monthLabel = m.toISOString().slice(0, 7); // YYYY-MM
        plan.push({
          feeItemId: item.id,
          labelAr: `${item.nameAr} — ${monthLabel}`,
          labelFr: `${item.nameFr} — ${monthLabel}`,
          dueDate: due,
          amount: round2(item.amount),
        });
      }
    } else {
      plan.push({
        feeItemId: item.id,
        labelAr: item.nameAr,
        labelFr: item.nameFr,
        dueDate: new Date(Date.UTC(yearStart.getUTCFullYear(), yearStart.getUTCMonth(), 5)),
        amount: round2(item.amount),
      });
    }
  }
  return plan;
}

/** An installment's state, given how much is paid and whether it's past due. */
export function installmentStatus(
  amount: number,
  amountPaid: number,
  dueDate: Date,
  today: Date,
): InstallmentStatus {
  if (cents(amountPaid) >= cents(amount)) return "PAID";
  if (cents(amountPaid) > 0) return "PARTIAL";
  return dueDate.getTime() < today.getTime() ? "OVERDUE" : "PENDING";
}

export type AllocInstallment = { id: string; amount: number; amountPaid: number };
export type Allocation = { installmentId: string; amount: number };

/**
 * Spread a payment across outstanding installments, oldest first (the caller
 * passes them already sorted by due date). Fills each installment's remaining
 * balance before moving on; a payment larger than the total outstanding leaves
 * the remainder unallocated (an overpayment / credit).
 */
export function allocate(
  paymentAmount: number,
  installments: AllocInstallment[],
): Allocation[] {
  let remaining = cents(paymentAmount);
  const allocations: Allocation[] = [];
  for (const inst of installments) {
    if (remaining <= 0) break;
    const outstanding = cents(inst.amount) - cents(inst.amountPaid);
    if (outstanding <= 0) continue;
    const take = Math.min(outstanding, remaining);
    allocations.push({ installmentId: inst.id, amount: mad(take) });
    remaining -= take;
  }
  return allocations;
}

/**
 * Schedule totals: gross (sum of installments), the discount credit, the net
 * owed (never below 0), how much has actually been paid, and the balance still
 * due.
 */
export function scheduleSummary(
  installmentAmounts: number[],
  discount: number,
  paymentAmounts: number[],
): { gross: number; discount: number; net: number; paid: number; balance: number } {
  const gross = mad(installmentAmounts.reduce((a, b) => a + cents(b), 0));
  const disc = Math.min(round2(discount), gross);
  const net = round2(gross - disc);
  const paid = mad(paymentAmounts.reduce((a, b) => a + cents(b), 0));
  const balance = round2(net - paid);
  return { gross, discount: disc, net, paid, balance };
}
