import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/fees";
import { formatDate, humanize } from "@/lib/format";
import { RevokeConcession } from "../forms";

export const metadata = { title: "Concessions" };

export default async function ConcessionsPage() {
  const user = await requirePortal("office");
  const db = await createClient();
  const { data } = await db.from("concessions").select("id, amount, category, reason, status, created_at, invoices(title, invoice_no), students(id, register_no, profiles(full_name)), approver:profiles!concessions_approved_by_fkey(full_name)").order("created_at", { ascending: false }).limit(300);
  type C = { id: string; amount: number; category: string; reason: string; status: string; created_at: string; invoices: { title: string; invoice_no: string }; students: { id: string; register_no: string; profiles: { full_name: string } }; approver: { full_name: string } | null };
  const rows = (data ?? []) as unknown as C[];
  return (
    <>
      <PageHeader title="Fee concessions" description="Concessions are granted from a student's ledger, against a specific invoice." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md"><StatCard label="Active concessions" value={rows.filter((r) => r.status === "approved").length} /><StatCard label="Total value" value={formatMoney(rows.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.amount), 0))} /></div>
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.id} empty={<EmptyState title="No concessions" />}
          columns={[
            { key: "s", header: "Student", primary: true, cell: (r) => <a className="hover:underline" href={`/portal/office/accounts/ledgers/${r.students.id}`}>{r.students.profiles.full_name} ({r.students.register_no})</a> },
            { key: "i", header: "Invoice", cell: (r) => r.invoices.title },
            { key: "c", header: "Category", cell: (r) => humanize(r.category) },
            { key: "a", header: "Amount", align: "right", cell: (r) => formatMoney(r.amount) },
            { key: "r", header: "Reason", cell: (r) => r.reason, mobileHidden: true },
            { key: "b", header: "Approved by", cell: (r) => `${r.approver?.full_name ?? "—"}, ${formatDate(r.created_at)}`, mobileHidden: true },
            { key: "st", header: "Status", cell: (r) => <span className="flex items-center gap-2"><StatusBadge status={r.status} />{r.status === "approved" && can(user, "finance.concessions") && <RevokeConcession id={r.id} />}</span> },
          ]} />
      </Card>
    </>
  );
}
