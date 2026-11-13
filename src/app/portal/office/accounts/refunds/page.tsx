import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EditRow } from "@/app/portal/admin/academic-forms";
import { formatMoney } from "@/lib/fees";
import { formatDateTime } from "@/lib/format";
import { RefundDecisionForm } from "../forms";

export const metadata = { title: "Refunds" };

export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requirePortal("office");
  const { view } = await searchParams;
  const db = await createClient();
  let q = db.from("refunds").select("id, amount, reason, status, created_at, decided_at, decision_note, processed_at, processed_reference, payments(amount, method, paid_at, receipts(receipt_no)), students(register_no, profiles(full_name)), requester:profiles!refunds_requested_by_fkey(full_name), decider:profiles!refunds_decided_by_fkey(full_name)").order("created_at", { ascending: false });
  q = view === "closed" ? q.in("status", ["rejected", "processed"]) : q.in("status", ["requested", "approved"]);
  const { data } = await q;
  type R = { id: string; amount: number; reason: string; status: string; created_at: string; decided_at: string | null; decision_note: string | null; processed_at: string | null; processed_reference: string | null; payments: { amount: number; method: string; paid_at: string }; students: { register_no: string; profiles: { full_name: string } }; requester: { full_name: string } | null; decider: { full_name: string } | null };
  return (
    <>
      <PageHeader title="Refund requests" description="Requested by accounts staff from a payment; approved by a different authorised accountant; then marked processed with the bank reference." />
      <Tabs active={view === "closed" ? "/portal/office/accounts/refunds?view=closed" : "/portal/office/accounts/refunds"} items={[{ href: "/portal/office/accounts/refunds", label: "Open" }, { href: "/portal/office/accounts/refunds?view=closed", label: "Closed" }]} />
      <Card>
        {((data ?? []) as unknown as R[]).length === 0 ? <EmptyState title="No refund requests" description="Request a refund from a payment in the student's ledger." /> : ((data ?? []) as unknown as R[]).map((r) => (
          <EditRow key={r.id} summary={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="block font-medium">{r.students.profiles.full_name} <span className="tabular text-xs text-muted">{r.students.register_no}</span></span><span className="text-xs text-muted">{r.reason}</span></span>
              <span className="flex items-center gap-2"><span className="tabular font-medium">{formatMoney(r.amount)}</span><StatusBadge status={r.status} /></span>
            </div>
          }>
            <div className="space-y-3 text-sm">
              <p className="text-muted">Requested by {r.requester?.full_name} on {formatDateTime(r.created_at)} · original payment {formatMoney(r.payments.amount)} ({r.payments.method})</p>
              {r.decided_at && <p className="text-muted">Decided by {r.decider?.full_name} on {formatDateTime(r.decided_at)}{r.decision_note && ` — ${r.decision_note}`}</p>}
              {r.processed_at && <p className="text-muted">Processed {formatDateTime(r.processed_at)} · ref {r.processed_reference}</p>}
              {can(user, "finance.correct") && ["requested", "approved"].includes(r.status) && <RefundDecisionForm id={r.id} status={r.status} />}
            </div>
          </EditRow>
        ))}
      </Card>
    </>
  );
}
