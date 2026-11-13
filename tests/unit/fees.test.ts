import { describe, expect, it } from "vitest";
import { collectionTotals, invoiceBalance, sumStructure, validatePaymentAmount } from "@/lib/fees";

const inv = { amount: 10000, due_date: "2026-07-15" };
const today = new Date("2026-07-01T10:00:00");

describe("invoiceBalance", () => {
  it("is open with no payments before the due date", () => {
    expect(invoiceBalance(inv, [], [], [], today)).toMatchObject({ outstanding: 10000, status: "open" });
  });
  it("is overdue after the due date", () => {
    expect(invoiceBalance(inv, [], [], [], new Date("2026-08-01")).status).toBe("overdue");
  });
  it("applies partial payments and concessions", () => {
    const r = invoiceBalance(inv, [{ amount: 500 }], [{ amount: 4000, status: "verified", mode: "live" }], [], today);
    expect(r).toMatchObject({ concession: 500, paid: 4000, outstanding: 5500, status: "partially_paid" });
  });
  it("ignores sandbox, pending, failed and reversed payments and revoked concessions", () => {
    const r = invoiceBalance(inv, [{ amount: 500, status: "revoked" }], [
      { amount: 9999, status: "verified", mode: "sandbox" }, { amount: 100, status: "pending", mode: "live" },
      { amount: 100, status: "failed", mode: "live" }, { amount: 100, status: "reversed", mode: "live" },
    ], [], today);
    expect(r.outstanding).toBe(10000);
  });
  it("adds processed refunds back to the balance", () => {
    const r = invoiceBalance(inv, [], [{ amount: 10000, status: "verified", mode: "live" }], [{ amount: 1000, status: "processed" }, { amount: 50, status: "requested" }], today);
    expect(r).toMatchObject({ outstanding: 1000, status: "partially_paid" });
  });
  it("is paid at exactly zero and has no floating point drift", () => {
    const r = invoiceBalance({ amount: 0.3, due_date: "2026-07-15" }, [], [{ amount: 0.1, status: "verified", mode: "live" }, { amount: 0.2, status: "verified", mode: "live" }], [], today);
    expect(r).toMatchObject({ outstanding: 0, status: "paid" });
  });
  it("is zero when cancelled", () => {
    expect(invoiceBalance({ ...inv, cancelled_at: "2026-07-01" }, [], [], [], today)).toMatchObject({ outstanding: 0, status: "cancelled" });
  });
});

describe("validatePaymentAmount", () => {
  it("accepts valid amounts up to the balance", () => {
    expect(validatePaymentAmount(5000, 5000)).toBeNull();
    expect(validatePaymentAmount(0.01, 5000)).toBeNull();
  });
  it("rejects zero, negative, excessive and over-precise amounts", () => {
    expect(validatePaymentAmount(0, 100)).toMatch(/greater than zero/);
    expect(validatePaymentAmount(-5, 100)).toMatch(/greater than zero/);
    expect(validatePaymentAmount(100.01, 100)).toMatch(/exceeds/);
    expect(validatePaymentAmount(1.005, 100)).toMatch(/two decimal/);
  });
});

describe("totals", () => {
  it("sums structures exactly", () => expect(sumStructure([{ amount: "1200.10" }, { amount: 300.2 }])).toBe(1500.3));
  it("collection totals count only verified live payments", () => {
    const t = collectionTotals([
      { amount: 100, status: "verified", mode: "live", method: "cash", paid_at: "2026-07-01T10:00:00Z" },
      { amount: 50.5, status: "verified", mode: "live", method: "upi", paid_at: "2026-07-01T11:00:00Z" },
      { amount: 999, status: "verified", mode: "sandbox", method: "online", paid_at: "2026-07-01T11:00:00Z" },
      { amount: 70, status: "reversed", mode: "live", method: "cheque", paid_at: "2026-07-02T11:00:00Z" },
    ]);
    expect(t).toEqual({ total: 150.5, count: 2, byMethod: { cash: 100, upi: 50.5 }, byDay: { "2026-07-01": 150.5 } });
  });
});
