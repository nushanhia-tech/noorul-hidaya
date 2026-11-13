import { Download, FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { SimpleBarChart } from "@/components/charts";
import { collectionTotals, formatMoney } from "@/lib/fees";
import { formatDate, todayISO } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";

export const metadata = { title: "Financial Reports" };

export default async function FinancialReports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; group?: string }> }) {
  const sp = await searchParams;
  const from = sp.from || `${todayISO().slice(0, 7)}-01`;
  const to = sp.to || todayISO();
  const group = sp.group === "month" ? "month" : "day";
  const db = await createClient();
  const [{ data: pays }, { data: bal }, { data: conc }, { data: refunds }] = await Promise.all([
    db.from("payments").select("amount, status, mode, method, paid_at").eq("status", "verified").gte("paid_at", `${from}T00:00:00`).lte("paid_at", `${to}T23:59:59.999`),
    db.from("invoice_balances").select("outstanding").gt("outstanding", 0),
    db.from("concessions").select("amount").eq("status", "approved").gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59.999`),
    db.from("refunds").select("amount").eq("status", "processed").gte("processed_at", `${from}T00:00:00`).lte("processed_at", `${to}T23:59:59.999`),
  ]);
  const t = collectionTotals((pays ?? []) as never);
  const series = new Map<string, number>();
  for (const [day, v] of Object.entries(t.byDay)) { const k = group === "month" ? day.slice(0, 7) : day; series.set(k, (series.get(k) ?? 0) + v); }
  const rows = [...series.entries()].sort().map(([period, amount]) => ({ period, amount }));
  const refundTotal = (refunds ?? []).reduce((s, r) => s + Number(r.amount), 0);
  return (
    <>
      <PageHeader title="Financial reports" description="Daily and monthly collection, concessions, refunds and outstanding — calculated from verified live transactions."
        actions={<>
          <a href={`/api/export/payments?from=${from}&to=${to}`} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> CSV</a>
          <a href={`/api/reports/collections?from=${from}&to=${to}`} className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-ink px-3 text-sm text-white"><FileDown className="h-4 w-4" /> PDF</a>
        </>} />
      <form className="mb-6 flex flex-wrap items-end gap-2">
        <label className="text-sm">From<input type="date" name="from" defaultValue={from} className="ml-2 h-10 rounded-sm border border-line-strong bg-white px-3" /></label>
        <label className="text-sm">To<input type="date" name="to" defaultValue={to} className="ml-2 h-10 rounded-sm border border-line-strong bg-white px-3" /></label>
        <select name="group" defaultValue={group} aria-label="Group by" className="h-10 rounded-sm border border-line-strong bg-white px-3 text-sm"><option value="day">Daily</option><option value="month">Monthly</option></select>
        <button className="h-10 rounded-sm bg-ink px-4 text-sm text-white">Apply</button>
      </form>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected" value={formatMoney(t.total)} hint={`${t.count} payments · ${formatDate(from)} – ${formatDate(to)}`} tone="teal" />
        <StatCard label="Refunds paid" value={formatMoney(refundTotal)} />
        <StatCard label="Concessions granted" value={formatMoney((conc ?? []).reduce((s, c) => s + Number(c.amount), 0))} />
        <StatCard label="Outstanding now" value={formatMoney((bal ?? []).reduce((s, b) => s + Number(b.outstanding), 0))} tone="accent" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card><CardHeader title={group === "month" ? "Monthly collection" : "Daily collection"} /><CardBody>{rows.length ? <SimpleBarChart data={rows} x="period" y="amount" name="Collected" format="money" height={280} /> : <EmptyState title="No collections in this range" />}</CardBody></Card>
        <Card>
          <CardHeader title="By method" />
          <DataTable rows={Object.entries(t.byMethod).map(([m, v]) => ({ m, v }))} rowKey={(r) => r.m} empty={<EmptyState title="No data" />}
            columns={[{ key: "m", header: "Method", primary: true, cell: (r) => PAYMENT_METHODS[r.m as keyof typeof PAYMENT_METHODS] ?? r.m }, { key: "v", header: "Amount", align: "right", cell: (r) => formatMoney(r.v) }, { key: "p", header: "Share", align: "right", cell: (r) => `${t.total ? Math.round((r.v / t.total) * 100) : 0}%` }]} />
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Collection table" />
        <DataTable rows={rows} rowKey={(r) => r.period} empty={<EmptyState title="No data" />} columns={[{ key: "p", header: "Period", primary: true, cell: (r) => r.period }, { key: "a", header: "Collected", align: "right", cell: (r) => formatMoney(r.amount) }]} />
      </Card>
    </>
  );
}
