import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/search";
import { formatMoney } from "@/lib/fees";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Student Ledgers" };

export default async function LedgersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = await createClient();
  const sel = "id, register_no, profiles!inner(full_name), programmes(code)";
  let students: { id: string }[] | null;
  if (q) {
    const t = q.replace(/[%_,()]/g, "");
    const [a, b] = await Promise.all([
      db.from("students").select(sel).ilike("register_no", `%${t}%`).limit(50),
      db.from("students").select(sel).ilike("profiles.full_name", `%${t}%`).limit(50),
    ]);
    students = [...new Map([...(a.data ?? []), ...(b.data ?? [])].map((x) => [x.id, x])).values()];
  } else {
    students = (await db.from("students").select(sel).order("register_no").limit(50)).data;
  }
  const ids = (students ?? []).map((s) => s.id);
  const { data: bal } = ids.length ? await db.from("student_fee_balances").select("*").in("student_id", ids) : { data: [] };
  const b = new Map((bal ?? []).map((x) => [x.student_id, x]));
  const rows = ((students ?? []) as unknown as { id: string; register_no: string; profiles: { full_name: string }; programmes: { code: string } | null }[]).map((s) => ({ ...s, bal: b.get(s.id) }));
  return (
    <>
      <PageHeader title="Student ledgers" description="Search a student to open their full fee ledger." />
      <FilterBar q={q} placeholder="Name or register number" className="mb-4" />
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/portal/office/accounts/ledgers/${r.id}`} empty={<EmptyState title="No students found" />}
          columns={[
            { key: "n", header: "Student", primary: true, cell: (r) => r.profiles.full_name },
            { key: "r", header: "Register no.", cell: (r) => <span className="tabular">{r.register_no}</span> },
            { key: "p", header: "Class", cell: (r) => r.programmes?.code ?? "—" },
            { key: "a", header: "Assigned", align: "right", cell: (r) => formatMoney(r.bal?.total_assigned ?? 0) },
            { key: "pd", header: "Paid", align: "right", cell: (r) => formatMoney(r.bal?.total_paid ?? 0) },
            { key: "o", header: "Outstanding", align: "right", cell: (r) => <span className={Number(r.bal?.outstanding) > 0 ? "font-medium text-accent-700" : ""}>{formatMoney(r.bal?.outstanding ?? 0)}</span> },
            { key: "d", header: "Next due", cell: (r) => formatDate(r.bal?.next_due), mobileHidden: true },
          ]} />
      </Card>
    </>
  );
}
