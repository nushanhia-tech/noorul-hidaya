import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, EmptyState, KeyValue, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/search";
import { formatMoney } from "@/lib/fees";
import { formatDate } from "@/lib/format";
import { CollectForm } from "../forms";

export const metadata = { title: "Collect Fees" };

export default async function CollectPage({ searchParams }: { searchParams: Promise<{ invoice?: string; q?: string }> }) {
  const user = await requirePortal("office");
  if (!can(user, "finance.collect")) return <><PageHeader title="Collect fees" /><Notice tone="warning">Your role cannot record payments.</Notice></>;
  const { invoice, q } = await searchParams;
  const db = await createClient();
  if (invoice) {
    const { data: i } = await db.from("invoice_balances").select("*, students(register_no, profiles(full_name))").eq("invoice_id", invoice).maybeSingle();
    if (!i) return <><PageHeader title="Collect fees" /><Notice tone="danger">Invoice not found.</Notice></>;
    const s = i.students as unknown as { register_no: string; profiles: { full_name: string } };
    return (
      <>
        <PageHeader title="Collect payment" back={{ href: `/portal/office/accounts/ledgers/${i.student_id}`, label: "Student ledger" }} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Card className="h-fit"><CardBody><KeyValue columns={1} items={[
            { label: "Student", value: `${s.profiles.full_name} (${s.register_no})` }, { label: "Fee", value: `${i.title} · ${i.invoice_no}` },
            { label: "Amount", value: formatMoney(i.amount) }, { label: "Already paid", value: formatMoney(i.paid_total) },
            { label: "Outstanding", value: <span className="font-display text-2xl font-semibold">{formatMoney(i.outstanding)}</span> },
          ]} /></CardBody></Card>
          <Card><CardHeader title="Record counter payment" /><CardBody>
            {Number(i.outstanding) > 0 ? <CollectForm invoiceId={i.invoice_id} outstanding={Number(i.outstanding)} idempotencyKey={randomUUID()} /> : <Notice tone="success">Nothing outstanding on this invoice.</Notice>}
          </CardBody></Card>
        </div>
      </>
    );
  }
  let rows: { invoice_id: string; invoice_no: string; title: string; outstanding: number; due_date: string; status: string; students: { register_no: string; profiles: { full_name: string } } }[] = [];
  if (q && q.trim().length >= 2) {
    const t = q.trim().replace(/[%_,()]/g, "");
    const { data: studs } = await db.from("students").select("id, profiles!inner(full_name)").or(`register_no.ilike.%${t}%`).limit(20);
    const { data: byName } = await db.from("students").select("id, profiles!inner(full_name)").ilike("profiles.full_name", `%${t}%`).limit(20);
    const ids = [...new Set([...(studs ?? []), ...(byName ?? [])].map((s) => s.id))];
    if (ids.length) rows = ((await db.from("invoice_balances").select("invoice_id, invoice_no, title, outstanding, due_date, status, students(register_no, profiles(full_name))").in("student_id", ids).gt("outstanding", 0).order("due_date")).data ?? []) as unknown as typeof rows;
  }
  return (
    <>
      <PageHeader title="Collect fees" description="Find the student, then choose the invoice being paid." />
      <FilterBar q={q} placeholder="Student name or register number" className="mb-4" />
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.invoice_id} rowHref={(r) => `/portal/office/accounts/collect?invoice=${r.invoice_id}`}
          empty={<EmptyState title={q ? "No outstanding invoices found" : "Search for a student"} />}
          columns={[
            { key: "s", header: "Student", primary: true, cell: (r) => `${r.students.profiles.full_name} (${r.students.register_no})` },
            { key: "f", header: "Fee", cell: (r) => r.title },
            { key: "d", header: "Due", cell: (r) => formatDate(r.due_date) },
            { key: "o", header: "Outstanding", align: "right", cell: (r) => formatMoney(r.outstanding) },
            { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          ]} />
      </Card>
    </>
  );
}
