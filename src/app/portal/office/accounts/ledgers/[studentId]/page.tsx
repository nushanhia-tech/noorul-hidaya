import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EditRow } from "@/app/portal/admin/academic-forms";
import { formatMoney } from "@/lib/fees";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { buttonClass } from "@/components/ui/button";
import { AdhocFeeForm, CancelInvoiceForm, ConcessionForm, RefundRequestForm, ReminderButton } from "../../forms";

export const metadata = { title: "Student Ledger" };

export default async function LedgerPage({ params }: { params: Promise<{ studentId: string }> }) {
  const user = await requirePortal("office");
  const { studentId } = await params;
  const db = await createClient();
  const { data: st } = await db.from("students").select("id, register_no, current_semester, profiles(full_name), programmes(name)").eq("id", studentId).maybeSingle();
  if (!st) notFound();
  const [{ data: inv }, { data: pays }, { data: conc }, { data: refunds }, { data: sum }] = await Promise.all([
    db.from("invoice_balances").select("*").eq("student_id", studentId).order("due_date", { ascending: false }),
    db.from("payments").select("id, invoice_id, amount, method, mode, status, paid_at, reference_no, receipts(receipt_no)").eq("student_id", studentId).order("created_at", { ascending: false }),
    db.from("concessions").select("id, invoice_id, amount, category, reason, status, created_at").eq("student_id", studentId),
    db.from("refunds").select("id, payment_id, amount, status").eq("student_id", studentId),
    db.from("student_fee_balances").select("*").eq("student_id", studentId).maybeSingle(),
  ]);
  const p = st as unknown as { register_no: string; current_semester: number; profiles: { full_name: string }; programmes: { name: string } };
  const refundedBy = new Map<string, number>();
  for (const r of refunds ?? []) if (r.status !== "rejected") refundedBy.set(r.payment_id, (refundedBy.get(r.payment_id) ?? 0) + Number(r.amount));
  return (
    <>
      <PageHeader eyebrow={p.register_no} title={`${p.profiles.full_name} — fee ledger`} description={`${p.programmes.name} · Semester ${p.current_semester}`} back={{ href: "/portal/office/accounts/ledgers", label: "Student ledgers" }} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Assigned" value={formatMoney(sum?.total_assigned ?? 0)} />
        <StatCard label="Concessions" value={formatMoney(sum?.total_concession ?? 0)} />
        <StatCard label="Paid (net of refunds)" value={formatMoney(Number(sum?.total_paid ?? 0) - Number(sum?.total_refunded ?? 0))} tone="teal" />
        <StatCard label="Outstanding" value={formatMoney(sum?.outstanding ?? 0)} tone="accent" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Invoices" description="Expand an invoice to collect, grant a concession or cancel" />
            {(inv ?? []).length === 0 ? <EmptyState title="No fees assigned" /> : (inv ?? []).map((i) => (
              <EditRow key={i.invoice_id} summary={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0"><span className="block font-medium">{i.title}</span><span className="tabular text-xs text-muted">{i.invoice_no} · due {formatDate(i.due_date)}</span></span>
                  <span className="flex items-center gap-3"><span className="tabular text-sm">{formatMoney(i.outstanding)} <span className="text-xs text-muted">of {formatMoney(i.amount)}</span></span><StatusBadge status={i.status} /></span>
                </div>
              }>
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    {Number(i.outstanding) > 0 && can(user, "finance.collect") && <Link href={`/portal/office/accounts/collect?invoice=${i.invoice_id}`} className={buttonClass("primary", "sm")}>Collect payment</Link>}
                    {Number(i.outstanding) > 0 && <ReminderButton invoiceId={i.invoice_id} />}
                  </div>
                  {(conc ?? []).filter((c) => c.invoice_id === i.invoice_id).map((c) => (
                    <p key={c.id} className="text-sm">Concession {formatMoney(c.amount)} · {humanize(c.category)} · {c.reason} <StatusBadge status={c.status} /></p>
                  ))}
                  {Number(i.outstanding) > 0 && can(user, "finance.concessions") && <div><p className="mb-2 text-sm font-medium">Grant concession</p><ConcessionForm invoiceId={i.invoice_id} studentId={studentId} /></div>}
                  {i.status !== "cancelled" && Number(i.paid_total) === 0 && can(user, "finance.correct") && <CancelInvoiceForm invoiceId={i.invoice_id} studentId={studentId} />}
                </div>
              </EditRow>
            ))}
          </Card>
          <Card>
            <CardHeader title="Payments" />
            {(pays ?? []).length === 0 ? <EmptyState title="No payments" /> : (pays ?? []).map((pm) => {
              const rc = pm.receipts as unknown as { receipt_no: string } | { receipt_no: string }[] | null;
              const no = Array.isArray(rc) ? rc[0]?.receipt_no : rc?.receipt_no;
              const refundable = Number(pm.amount) - (refundedBy.get(pm.id) ?? 0);
              return (
                <EditRow key={pm.id} summary={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><span className="tabular font-medium">{formatMoney(pm.amount)}</span> <span className="text-xs text-muted">{PAYMENT_METHODS[pm.method as keyof typeof PAYMENT_METHODS]} · {formatDateTime(pm.paid_at)}</span></span>
                    <span className="flex items-center gap-2">{pm.mode === "sandbox" && <Badge tone="danger">Sandbox</Badge>}<StatusBadge status={pm.status} />{no && <span className="tabular text-xs text-muted">{no}</span>}</span>
                  </div>
                }>
                  <div className="space-y-4 text-sm">
                    {no && <a href={`/api/receipts/${pm.id}`} className="font-medium text-royal hover:underline">Download receipt {no}</a>}
                    {pm.reference_no && <p>Reference: {pm.reference_no}</p>}
                    {pm.status === "verified" && pm.mode === "live" && refundable > 0 && can(user, "finance.collect") && <RefundRequestForm paymentId={pm.id} max={refundable} />}
                  </div>
                </EditRow>
              );
            })}
          </Card>
        </div>
        {can(user, "finance.structures") && <Card className="h-fit"><CardHeader title="Assign an individual fee" description="e.g. examination, fine or certificate fee" /><CardBody><AdhocFeeForm studentId={studentId} /></CardBody></Card>}
      </div>
    </>
  );
}
