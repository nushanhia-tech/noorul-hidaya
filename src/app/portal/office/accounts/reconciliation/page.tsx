import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { formatMoney } from "@/lib/fees";
import { formatDate, formatDateTime } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ReconcileForm } from "../forms";

export const metadata = { title: "Reconciliation" };

export default async function ReconciliationPage() {
  const user = await requirePortal("office");
  const db = await createClient();
  const [{ data: open }, { data: done }] = await Promise.all([
    db.from("payments").select("id, amount, method, paid_at, reference_no, provider_payment_id, students(register_no)").eq("status", "verified").eq("mode", "live").neq("method", "cash").is("reconciled_at", null).order("paid_at"),
    db.from("payments").select("id, amount, method, paid_at, bank_reference, reconciled_at, reconciler:profiles!payments_reconciled_by_fkey(full_name)").not("reconciled_at", "is", null).order("reconciled_at", { ascending: false }).limit(50),
  ]);
  type O = { id: string; amount: number; method: string; paid_at: string; reference_no: string | null; provider_payment_id: string | null; students: { register_no: string } };
  const openRows = (open ?? []) as unknown as O[];
  const total = openRows.reduce((s, r) => s + Number(r.amount), 0);
  return (
    <>
      <PageHeader title="Transaction reconciliation" description="Match bank, UPI, cheque and gateway payments against the bank statement." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={`Unreconciled (${openRows.length})`} description={`Total ${formatMoney(total)}`} />
          <CardBody>
            {openRows.length === 0 ? <EmptyState title="Everything is reconciled" /> : can(user, "finance.collect")
              ? <ReconcileForm rows={openRows.map((r) => ({ id: r.id, label: `${formatDate(r.paid_at)} · ${formatMoney(r.amount)} · ${PAYMENT_METHODS[r.method as keyof typeof PAYMENT_METHODS]} · ${r.reference_no ?? r.provider_payment_id ?? "no ref"} · ${r.students.register_no}` }))} />
              : <Notice>Your role can view but not reconcile.</Notice>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recently reconciled" />
          <DataTable rows={(done ?? []) as unknown as { id: string; amount: number; method: string; bank_reference: string; reconciled_at: string; reconciler: { full_name: string } | null }[]} rowKey={(r) => r.id} empty={<EmptyState title="None yet" />}
            columns={[
              { key: "a", header: "Amount", primary: true, cell: (r) => formatMoney(r.amount) },
              { key: "b", header: "Bank ref", cell: (r) => r.bank_reference },
              { key: "w", header: "Reconciled", cell: (r) => `${formatDateTime(r.reconciled_at)} · ${r.reconciler?.full_name ?? ""}` },
            ]} />
        </Card>
      </div>
    </>
  );
}
