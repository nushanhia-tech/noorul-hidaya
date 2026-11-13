import Link from "next/link";
import { AlertTriangle, Banknote, CalendarDays, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { SimpleBarChart } from "@/components/charts";
import { collectionTotals, formatMoney } from "@/lib/fees";
import { formatDateTime, todayISO } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";

export const metadata = { title: "Accounts Dashboard" };

export default async function AccountsDashboard() {
  const db = await createClient();
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [{ data: month }, { data: bal }, { data: recent }, { data: pendingRefunds }, { data: unrec }] = await Promise.all([
    db.from("payments").select("amount, status, mode, method, paid_at").eq("status", "verified").gte("paid_at", `${monthStart}T00:00:00`),
    db.from("invoice_balances").select("outstanding, due_date, status").gt("outstanding", 0),
    db.from("payments").select("id, amount, method, mode, paid_at, students(register_no, profiles(full_name))").eq("status", "verified").order("paid_at", { ascending: false }).limit(8),
    db.from("refunds").select("id").in("status", ["requested", "approved"]),
    db.from("payments").select("id").eq("status", "verified").eq("mode", "live").neq("method", "cash").is("reconciled_at", null),
  ]);
  const m = collectionTotals((month ?? []) as never);
  const t = collectionTotals(((month ?? []) as { paid_at: string }[]).filter((p) => p.paid_at.startsWith(today)) as never);
  const outstanding = (bal ?? []).reduce((s, b) => s + Number(b.outstanding), 0);
  const overdue = (bal ?? []).filter((b) => b.status === "overdue" || (b.due_date < today));
  const methods = Object.entries(m.byMethod).map(([k, v]) => ({ method: PAYMENT_METHODS[k as keyof typeof PAYMENT_METHODS] ?? k, amount: v }));
  const sandboxCount = (month ?? []).filter((p) => p.mode === "sandbox").length;
  return (
    <>
      <PageHeader title="Fees & accounts" description="All figures use verified live payments only. Sandbox test transactions are never counted." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected today" value={formatMoney(t.total)} hint={`${t.count} payment(s)`} icon={Banknote} tone="teal" />
        <StatCard label="Collected this month" value={formatMoney(m.total)} hint={`${m.count} payment(s)`} icon={CalendarDays} tone="royal" />
        <StatCard label="Outstanding" value={formatMoney(outstanding)} hint={`${bal?.length ?? 0} open invoice(s)`} icon={Wallet} tone="accent" href="/portal/office/accounts/outstanding" />
        <StatCard label="Overdue invoices" value={overdue.length} icon={AlertTriangle} tone="danger" href="/portal/office/accounts/outstanding?overdue=1" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Collected this month by method" />
          <CardBody>
            {methods.length ? <SimpleBarChart data={methods} x="method" y="amount" name="Collected" format="money" /> : <EmptyState title="No collections this month" />}
            {sandboxCount > 0 && <p className="mt-3 text-xs text-muted">{sandboxCount} sandbox test payment(s) this month are excluded.</p>}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Needs attention" />
            <ul className="divide-y divide-line text-sm">
              <li><Link href="/portal/office/accounts/refunds" className="flex justify-between px-5 py-3 hover:bg-white">Refunds awaiting decision/processing<span className="tabular font-medium">{pendingRefunds?.length ?? 0}</span></Link></li>
              <li><Link href="/portal/office/accounts/reconciliation" className="flex justify-between px-5 py-3 hover:bg-white">Non-cash payments to reconcile<span className="tabular font-medium">{unrec?.length ?? 0}</span></Link></li>
            </ul>
          </Card>
          <Card>
            <CardHeader title="Recent payments" action={<Link href="/portal/office/accounts/payments" className="text-[13px] font-medium text-royal hover:underline">All</Link>} />
            <DataTable rows={(recent ?? []) as unknown as { id: string; amount: number; method: string; mode: string; paid_at: string; students: { register_no: string; profiles: { full_name: string } } }[]}
              rowKey={(r) => r.id} empty={<EmptyState title="No payments yet" />}
              columns={[
                { key: "s", header: "Student", primary: true, cell: (r) => r.students.profiles.full_name },
                { key: "a", header: "Amount", align: "right", cell: (r) => <span>{formatMoney(r.amount)}{r.mode === "sandbox" && <span className="ml-1 text-xs text-danger">(test)</span>}</span> },
                { key: "d", header: "When", cell: (r) => formatDateTime(r.paid_at) },
              ]} />
          </Card>
        </div>
      </div>
    </>
  );
}
