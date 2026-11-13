import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, StatCard, Tabs } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/fees";
import { formatDate, todayISO } from "@/lib/format";
import { ReminderButton } from "../forms";

export const metadata = { title: "Outstanding Fees" };

export default async function OutstandingPage({ searchParams }: { searchParams: Promise<{ overdue?: string }> }) {
  const { overdue } = await searchParams;
  const db = await createClient();
  let q = db.from("invoice_balances").select("invoice_id, invoice_no, title, amount, paid_total, outstanding, due_date, status, last:invoices(last_reminded_at), students(id, register_no, profiles(full_name))").gt("outstanding", 0).order("due_date");
  if (overdue) q = q.lt("due_date", todayISO());
  const { data } = await q.limit(500);
  type R = { invoice_id: string; invoice_no: string; title: string; amount: number; paid_total: number; outstanding: number; due_date: string; status: string; students: { id: string; register_no: string; profiles: { full_name: string } } };
  const rows = (data ?? []) as unknown as R[];
  const total = rows.reduce((s, r) => s + Number(r.outstanding), 0);
  return (
    <>
      <PageHeader title="Outstanding fees" actions={<a href="/api/export/outstanding" className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> CSV</a>} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md"><StatCard label="Invoices" value={rows.length} /><StatCard label="Total outstanding" value={formatMoney(total)} tone="accent" /></div>
      <Tabs active={overdue ? "/portal/office/accounts/outstanding?overdue=1" : "/portal/office/accounts/outstanding"} items={[{ href: "/portal/office/accounts/outstanding", label: "All outstanding" }, { href: "/portal/office/accounts/outstanding?overdue=1", label: "Overdue" }]} />
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.invoice_id} rowHref={(r) => `/portal/office/accounts/ledgers/${r.students.id}`} empty={<EmptyState title="Nothing outstanding" />}
          columns={[
            { key: "s", header: "Student", primary: true, cell: (r) => `${r.students.profiles.full_name} (${r.students.register_no})` },
            { key: "f", header: "Fee", cell: (r) => r.title },
            { key: "d", header: "Due", cell: (r) => formatDate(r.due_date) },
            { key: "o", header: "Outstanding", align: "right", cell: (r) => formatMoney(r.outstanding) },
            { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "rm", header: "", cell: (r) => <ReminderButton invoiceId={r.invoice_id} /> },
          ]} />
      </Card>
    </>
  );
}
