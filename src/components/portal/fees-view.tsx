import Link from "next/link";
import { CreditCard, Download, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, StatCard, Notice } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/fees";
import { formatDate, humanize } from "@/lib/format";
import { providerStatus } from "@/lib/payments/provider";
import { PAYMENT_METHODS } from "@/lib/constants";
import { buttonClass } from "@/components/ui/button";

/** Shared by the student and parent portals. */
export async function FeesView({ studentId, canPay, base, flash }: { studentId: string; canPay: boolean; base: string; flash?: { paid?: string; failed?: string } }) {
  const supabase = await createClient();
  const [{ data: invoices }, { data: payments }, { data: summary }] = await Promise.all([
    supabase.from("invoice_balances").select("*").eq("student_id", studentId).order("due_date", { ascending: false }),
    supabase.from("payments").select("id, amount, method, mode, status, paid_at, reference_no, created_at, invoice_id, receipts(receipt_no)").eq("student_id", studentId).order("created_at", { ascending: false }),
    supabase.from("student_fee_balances").select("*").eq("student_id", studentId).maybeSingle(),
  ]);
  const provider = providerStatus();
  const invTitle = new Map((invoices ?? []).map((i) => [i.invoice_id, i.title]));
  return (
    <>
      <PageHeader title="Fees & payments" description="Assigned fees, payments and receipts. Figures exclude any sandbox test transactions." />
      {flash?.paid && <Notice tone="success" className="mb-6">Payment confirmed. Your receipt is available below.</Notice>}
      {flash?.failed && <Notice tone="danger" className="mb-6">The payment was not completed. No receipt was issued. If money was deducted, contact the accounts office with the transaction reference.</Notice>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total assigned" value={formatMoney(summary?.total_assigned ?? 0)} icon={Wallet} />
        <StatCard label="Concessions" value={formatMoney(summary?.total_concession ?? 0)} />
        <StatCard label="Paid" value={formatMoney(summary?.total_paid ?? 0)} tone="teal" />
        <StatCard label="Outstanding" value={formatMoney(summary?.outstanding ?? 0)} tone={Number(summary?.outstanding) > 0 ? "accent" : "neutral"} hint={summary?.next_due ? `Next due ${formatDate(summary.next_due)}` : undefined} />
      </div>
      <Card className="mb-6">
        <CardHeader title="Assigned fees" description={canPay && !provider.configured ? "Online payment is not available yet — please pay at the accounts office." : undefined} />
        <DataTable
          rows={invoices ?? []}
          rowKey={(r) => r.invoice_id}
          empty={<EmptyState icon={Wallet} title="No fees assigned" />}
          columns={[
            { key: "title", header: "Fee", primary: true, cell: (r) => <span><span className="font-medium text-ink">{r.title}</span><span className="tabular block text-xs text-faint">{r.invoice_no}</span></span> },
            { key: "due", header: "Due date", cell: (r) => formatDate(r.due_date) },
            { key: "amount", header: "Amount", align: "right", cell: (r) => formatMoney(r.amount) },
            { key: "conc", header: "Concession", align: "right", cell: (r) => formatMoney(r.concession_total), mobileHidden: true },
            { key: "paid", header: "Paid", align: "right", cell: (r) => formatMoney(r.paid_total) },
            { key: "out", header: "Balance", align: "right", cell: (r) => <span className="font-medium text-ink">{Number(r.outstanding) < 0 ? `${formatMoney(-r.outstanding)} credit` : formatMoney(r.outstanding)}</span> },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            ...(canPay && provider.configured ? [{
              key: "pay", header: "", cell: (r: { outstanding: number; invoice_id: string }) => Number(r.outstanding) > 0
                ? <Link href={`${base}/pay/${r.invoice_id}`} className={buttonClass("primary", "sm", "relative z-10")}><CreditCard className="h-3.5 w-3.5" /> Pay</Link> : null,
            }] : []),
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="Payment history" />
        <DataTable
          rows={payments ?? []}
          rowKey={(r) => r.id}
          empty={<EmptyState title="No payments yet" />}
          columns={[
            { key: "date", header: "Date", primary: true, cell: (r) => formatDate(r.paid_at ?? r.created_at) },
            { key: "for", header: "For", cell: (r) => invTitle.get(r.invoice_id) ?? "—" },
            { key: "method", header: "Method", cell: (r) => PAYMENT_METHODS[r.method as keyof typeof PAYMENT_METHODS] ?? humanize(r.method) },
            { key: "amount", header: "Amount", align: "right", cell: (r) => formatMoney(r.amount) },
            { key: "status", header: "Status", cell: (r) => <span className="flex gap-1.5"><StatusBadge status={r.status} />{r.mode === "sandbox" && <Badge tone="danger">Sandbox test</Badge>}</span> },
            { key: "receipt", header: "Receipt", cell: (r) => {
              const rc = (r.receipts as unknown as { receipt_no: string } | { receipt_no: string }[] | null);
              const no = Array.isArray(rc) ? rc[0]?.receipt_no : rc?.receipt_no;
              return no ? <a href={`/api/receipts/${r.id}`} className="relative z-10 inline-flex items-center gap-1 text-[13px] font-medium text-royal hover:underline"><Download className="h-3.5 w-3.5" />{no}</a> : <span className="text-faint">—</span>;
            } },
          ]}
        />
      </Card>
    </>
  );
}
