import { describe, it, expect } from "vitest";
import {
  round2,
  formatMAD,
  monthsBetween,
  buildInstallmentPlan,
  installmentStatus,
  allocate,
  scheduleSummary,
  type FeeItemLike,
} from "../fees";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("formatMAD", () => {
  it("groups thousands, 2 decimals, localized unit", () => {
    expect(formatMAD(1500, "fr")).toBe("1 500,00 MAD");
    expect(formatMAD(9000.5, "fr")).toBe("9 000,50 MAD");
    expect(formatMAD(1500, "ar")).toBe("1 500,00 د.م.");
    expect(formatMAD(0, "fr")).toBe("0,00 MAD");
  });
});

describe("monthsBetween", () => {
  it("lists first-of-month across the span, inclusive", () => {
    const months = monthsBetween(utc(2025, 9, 15), utc(2026, 6, 30));
    expect(months).toHaveLength(10); // Sept 2025 .. Jun 2026
    expect(months[0].toISOString().slice(0, 10)).toBe("2025-09-01");
    expect(months[9].toISOString().slice(0, 10)).toBe("2026-06-01");
  });
  it("handles a single month", () => {
    expect(monthsBetween(utc(2026, 3, 10), utc(2026, 3, 20))).toHaveLength(1);
  });
});

describe("buildInstallmentPlan", () => {
  const items: FeeItemLike[] = [
    { id: "insc", isMonthly: false, amount: 500, nameAr: "تسجيل", nameFr: "Inscription" },
    { id: "tui", isMonthly: true, amount: 900, nameAr: "شهري", nameFr: "Mensualité" },
  ];
  it("makes one installment per month for a monthly fee, one for a one-off", () => {
    const plan = buildInstallmentPlan(items, utc(2025, 9, 1), utc(2026, 6, 30));
    const oneOff = plan.filter((p) => p.feeItemId === "insc");
    const monthly = plan.filter((p) => p.feeItemId === "tui");
    expect(oneOff).toHaveLength(1);
    expect(monthly).toHaveLength(10);
    expect(monthly[0].dueDate.toISOString().slice(0, 10)).toBe("2025-09-05");
    expect(monthly.every((m) => m.amount === 900)).toBe(true);
  });
  it("gross total is items summed across their occurrences", () => {
    const plan = buildInstallmentPlan(items, utc(2025, 9, 1), utc(2026, 6, 30));
    const gross = plan.reduce((a, p) => a + p.amount, 0);
    expect(gross).toBe(500 + 900 * 10); // 9500
  });
});

describe("installmentStatus", () => {
  const past = utc(2026, 1, 1);
  const future = utc(2030, 1, 1);
  const today = utc(2026, 7, 15);
  it("PAID when covered (float-safe)", () => {
    expect(installmentStatus(0.3, 0.1 + 0.2, future, today)).toBe("PAID");
    expect(installmentStatus(900, 900, future, today)).toBe("PAID");
  });
  it("PARTIAL when some but not all is paid", () => {
    expect(installmentStatus(900, 400, future, today)).toBe("PARTIAL");
  });
  it("OVERDUE when unpaid and past due, PENDING when unpaid but not yet due", () => {
    expect(installmentStatus(900, 0, past, today)).toBe("OVERDUE");
    expect(installmentStatus(900, 0, future, today)).toBe("PENDING");
  });
});

describe("allocate — oldest first", () => {
  const insts = [
    { id: "a", amount: 900, amountPaid: 0 },
    { id: "b", amount: 900, amountPaid: 0 },
    { id: "c", amount: 900, amountPaid: 0 },
  ];
  it("fills the oldest installment fully before the next", () => {
    expect(allocate(900, insts)).toEqual([{ installmentId: "a", amount: 900 }]);
  });
  it("spills across installments", () => {
    expect(allocate(1000, insts)).toEqual([
      { installmentId: "a", amount: 900 },
      { installmentId: "b", amount: 100 },
    ]);
  });
  it("skips already-paid installments and respects partial balances", () => {
    const partial = [
      { id: "a", amount: 900, amountPaid: 900 },
      { id: "b", amount: 900, amountPaid: 400 },
    ];
    expect(allocate(300, partial)).toEqual([{ installmentId: "b", amount: 300 }]);
  });
  it("leaves an overpayment unallocated", () => {
    const one = [{ id: "a", amount: 500, amountPaid: 0 }];
    expect(allocate(800, one)).toEqual([{ installmentId: "a", amount: 500 }]);
  });
  it("does not misallocate with decimal amounts", () => {
    const decs = [
      { id: "a", amount: 0.1, amountPaid: 0 },
      { id: "b", amount: 0.2, amountPaid: 0 },
    ];
    expect(allocate(0.3, decs)).toEqual([
      { installmentId: "a", amount: 0.1 },
      { installmentId: "b", amount: 0.2 },
    ]);
  });
});

describe("scheduleSummary", () => {
  it("computes gross, net after discount, paid and balance", () => {
    const s = scheduleSummary([500, 900, 900, 900], 300, [1000, 500]);
    expect(s.gross).toBe(3200);
    expect(s.discount).toBe(300);
    expect(s.net).toBe(2900);
    expect(s.paid).toBe(1500);
    expect(s.balance).toBe(1400);
  });
  it("caps a discount at the gross and never goes negative", () => {
    const s = scheduleSummary([500], 9999, [500]);
    expect(s.discount).toBe(500);
    expect(s.net).toBe(0);
    expect(s.balance).toBe(-500); // overpaid relative to net -> credit
  });
  it("is exact with decimal centimes", () => {
    const s = scheduleSummary([0.1, 0.2], 0, [0.3]);
    expect(s.gross).toBe(0.3);
    expect(s.balance).toBe(0);
  });
});

describe("round2", () => {
  it("rounds half up at 2 decimals", () => {
    expect(round2(0.005)).toBe(0.01);
    expect(round2(1500.004)).toBe(1500);
  });
});
