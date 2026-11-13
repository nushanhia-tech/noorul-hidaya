import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/search";

export const metadata = { title: "Student Search" };

export default async function StudentSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePortal("office");
  const { q } = await searchParams;
  const db = await createClient();
  let rows: { id: string; register_no: string; current_semester: number; status: string; profiles: { full_name: string; email: string }; programmes: { code: string } | null }[] = [];
  if (q && q.trim().length >= 2) {
    const t = q.trim().replace(/[%_,()]/g, "");
    const [byReg, byName] = await Promise.all([
      db.from("students").select("id, register_no, current_semester, status, profiles(full_name, email), programmes(code)").ilike("register_no", `%${t}%`).limit(25),
      db.from("students").select("id, register_no, current_semester, status, profiles!inner(full_name, email), programmes(code)").ilike("profiles.full_name", `%${t}%`).limit(25),
    ]);
    const map = new Map<string, (typeof rows)[number]>();
    for (const r of [...(byReg.data ?? []), ...(byName.data ?? [])] as unknown as typeof rows) map.set(r.id, r);
    rows = [...map.values()];
  }
  return (
    <>
      <PageHeader title="Student search" description="Find a student by name or register number to see their office records." />
      <FilterBar q={q} placeholder="Name or register number (min. 2 characters)" className="mb-5" />
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/portal/office/students/${r.id}`}
          empty={<EmptyState icon={Search} title={q ? "No students found" : "Search to begin"} />}
          columns={[
            { key: "n", header: "Name", primary: true, cell: (r) => r.profiles.full_name },
            { key: "r", header: "Register no.", cell: (r) => <span className="tabular">{r.register_no}</span> },
            { key: "p", header: "Programme", cell: (r) => r.programmes?.code ?? "—" },
            { key: "s", header: "Semester", cell: (r) => r.current_semester },
            { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          ]} />
      </Card>
    </>
  );
}
