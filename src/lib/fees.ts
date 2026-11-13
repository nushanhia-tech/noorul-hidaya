/**
 * Fee arithmetic. Mirrors the database view `invoice_balances` so that the UI
 * and tests use the same rules. All amounts are handled in integer paise to
 * avoid floating point drift.
 */
export type InvoiceLike = { amount: number; due_date: string; cancelled_at?: string | null };
export type MoneyEntry = { amount: number };
export type PaymentLike = MoneyEntry & { status: string; mode: string };
export type RefundLike = MoneyEntry & { status: string };

export const toPaise = (n: number | string) => Math.round(Number(n) * 100);
export const fromPaise = (p: number) => p / 100;

export type InvoiceStatus = "open" | "partially_paid" | "paid" | "overdue" | "cancelled";

export function invoiceBalance(
  invoice: InvoiceLike,
  concessions: (MoneyEntry & { status?: string })[],
  payments: PaymentLike[],
  refunds: RefundLike[],
  today: Date = new Date(),
) {
  const concession = concessions.filter((c) => (c.status ?? "approved") === "approved").reduce((s, c) => s + toPaise(c.amount), 0);
  const paid = payments.filter((p) => p.status === "verified" && p.mode === "live").reduce((s, p) => s + toPaise(p.amount), 0);
  const refunded = refunds.filter((r) => r.status === "processed").reduce((s, r) => s + toPaise(r.amount), 0);
  const cancelled = Boolean(invoice.cancelled_at);
  const outstanding = cancelled ? 0 : toPaise(invoice.amount) - concession - paid + refunded;
  let status: InvoiceStatus;
  if (cancelled) status = "cancelled";
  else if (outstanding <= 0) status = "paid";
  else if (paid > 0) status = "partially_paid";
  else if (new Date(invoice.due_date + "T23:59:59") < today) status = "overdue";
  else status = "open";
  return {
    concession: fromPaise(concession),
    paid: fromPaise(paid),
    refunded: fromPaise(refunded),
    outstanding: fromPaise(outstanding),
    status,
  };
}

/** Validate a counter payment before sending it to the database. */
export function validatePaymentAmount(amount: number, outstanding: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount greater than zero.";
  if (toPaise(amount) !== Math.round(amount * 100)) return "Amounts can have at most two decimal places.";
  if (toPaise(amount) > toPaise(outstanding)) return `Amount exceeds the outstanding balance of ${formatMoney(outstanding)}.`;
  return null;
}

export function sumStructure(items: { amount: number | string }[]) {
  return fromPaise(items.reduce((s, i) => s + toPaise(i.amount), 0));
}

export function formatMoney(n: number | string | null | undefined, currency = "INR") {
  const value = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
}

/** Totals for reports from a list of verified payments. Sandbox payments never count. */
export function collectionTotals(payments: (PaymentLike & { method: string; paid_at: string | null })[]) {
  const live = payments.filter((p) => p.status === "verified" && p.mode === "live");
  const byMethod: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let total = 0;
  for (const p of live) {
    const paise = toPaise(p.amount);
    total += paise;
    byMethod[p.method] = (byMethod[p.method] ?? 0) + paise;
    const day = (p.paid_at ?? "").slice(0, 10);
    if (day) byDay[day] = (byDay[day] ?? 0) + paise;
  }
  const conv = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fromPaise(v)]));
  return { total: fromPaise(total), count: live.length, byMethod: conv(byMethod), byDay: conv(byDay) };
}
