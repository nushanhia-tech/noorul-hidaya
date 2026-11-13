import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Pagination } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/search";
import { formatMoney } from "@/lib/fees";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Receipts" };
const PAGE = 30;

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await createClient();
  let q = db.from("receipts").select("id, receipt_no, issued_at, payment_id, payments(amount, mode, status, students(register_no, profiles(full_name)))", { count: "exact" }).order("issued_at", { ascending: false });
  if (sp.q) q = q.ilike("receipt_no", `%${sp.q.replace(/[%_]/g, "")}%`);
  const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  type R = { id: string; receipt_no: string; issued_at: string; payment_id: string; payments: { amount: number; mode: string; status: string; students: { register_no: string; profiles: { full_name: string } } } };
  return (
    <>
      <PageHeader title="Receipts" description="Receipts exist only for verified payments. Reversed payments keep their receipt for the audit trail, marked as reversed." />
      <FilterBar q={sp.q} placeholder="Receipt number" className="mb-4" />
      <Card>
        <DataTable rows={(data ?? []) as unknown as R[]} rowKey={(r) => r.id} rowHref={(r) => `/api/receipts/${r.payment_id}`} empty={<EmptyState title="No receipts" />}
          columns={[
            { key: "n", header: "Receipt", primary: true, cell: (r) => <span className="tabular">{r.receipt_no}</span> },
            { key: "s", header: "Student", cell: (r) => `${r.payments.students.profiles.full_name} (${r.payments.students.register_no})` },
            { key: "a", header: "Amount", align: "right", cell: (r) => formatMoney(r.payments.amount) },
            { key: "d", header: "Issued", cell: (r) => formatDateTime(r.issued_at) },
            { key: "f", header: "", cell: (r) => r.payments.mode === "sandbox" ? <Badge tone="danger">Sandbox</Badge> : r.payments.status === "reversed" ? <Badge tone="danger">Reversed</Badge> : null },
          ]} />
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/portal/office/accounts/receipts?page=${p}${sp.q ? `&q=${sp.q}` : ""}`} />
      </Card>
    </>
  );
}
