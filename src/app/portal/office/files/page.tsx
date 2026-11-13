import { FolderOpen, Plus, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { lookups } from "@/lib/data/lookups";
import { PageHeader, EmptyState, Tabs, Pagination, StatCard } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { FILE_CATEGORIES, FILE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, relativeTime, todayISO } from "@/lib/format";

export const metadata = { title: "Office Files" };
const PAGE = 25;

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; status?: string; category?: string; section?: string; page?: string }> }) {
  const user = await requirePortal("office");
  const sp = await searchParams;
  const view = sp.view ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await createClient();
  const lk = await lookups();
  let q = db.from("office_files").select("id, reference_no, subject, category, status, priority, due_date, updated_at, assignee:profiles!office_files_assigned_to_fkey(full_name), office_sections(name)", { count: "exact" }).order("updated_at", { ascending: false });
  if (view === "mine") q = q.eq("assigned_to", user.id).neq("status", "archived");
  else if (view === "archive") q = q.eq("status", "archived");
  else q = q.neq("status", "archived");
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.category) q = q.eq("category", sp.category);
  if (sp.section) q = q.eq("section_id", sp.section);
  if (sp.q) { const t = sp.q.replace(/[%_,()]/g, ""); q = q.or(`reference_no.ilike.%${t}%,subject.ilike.%${t}%,description.ilike.%${t}%`); }
  const [{ data, count }, { data: all }] = await Promise.all([q.range((page - 1) * PAGE, page * PAGE - 1), db.from("office_files").select("status, due_date")]);
  const today = todayISO();
  const stats = (all ?? []);
  const rows = (data ?? []) as unknown as { id: string; reference_no: string; subject: string; category: string; status: string; priority: string; due_date: string | null; updated_at: string; assignee: { full_name: string } | null; office_sections: { name: string } | null }[];
  const qs = (p: number) => `/portal/office/files?${new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <PageHeader title="Office files" description="Paperless file management: every file has a reference number, an owner and a full movement history."
        actions={<>
          <a href="/api/export/files" className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> CSV</a>
          <LinkButton href="/portal/office/files/new"><Plus className="h-4 w-4" /> New file</LinkButton>
        </>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total files" value={stats.length} />
        <StatCard label="New / unassigned" value={stats.filter((f) => f.status === "new").length} tone="royal" />
        <StatCard label="In progress" value={stats.filter((f) => ["assigned", "in_progress", "waiting_info"].includes(f.status)).length} tone="accent" />
        <StatCard label="Overdue" value={stats.filter((f) => f.due_date && f.due_date < today && !["completed", "archived"].includes(f.status)).length} tone="danger" />
        <StatCard label="Completed" value={stats.filter((f) => f.status === "completed").length} tone="teal" />
      </div>
      <Tabs active={`/portal/office/files${view === "all" ? "" : `?view=${view}`}`} items={[
        { href: "/portal/office/files", label: "All files" }, { href: "/portal/office/files?view=mine", label: "My assigned files" }, { href: "/portal/office/files?view=archive", label: "Archive" },
      ]} />
      <FilterBar q={sp.q} placeholder="Reference, subject or description" className="mb-4" hidden={{ view: sp.view }}>
        <FilterSelect name="status" value={sp.status} label="Status" options={Object.entries(FILE_STATUS_LABELS).filter(([k]) => k !== "archived").map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="category" value={sp.category} label="Category" options={Object.entries(FILE_CATEGORIES).map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="section" value={sp.section} label="Section" options={lk.sections.map((s) => ({ value: s.id, label: s.name }))} />
      </FilterBar>
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/portal/office/files/${r.id}`}
          empty={<EmptyState icon={FolderOpen} title="No files found" description={view === "mine" ? "No files are assigned to you." : undefined} />}
          columns={[
            { key: "s", header: "Subject", primary: true, cell: (r) => r.subject },
            { key: "r", header: "Reference", cell: (r) => <span className="tabular">{r.reference_no}</span> },
            { key: "c", header: "Category", cell: (r) => FILE_CATEGORIES[r.category as keyof typeof FILE_CATEGORIES], mobileHidden: true },
            { key: "a", header: "With", cell: (r) => r.assignee?.full_name ?? r.office_sections?.name ?? "—" },
            { key: "d", header: "Due", cell: (r) => <span className={r.due_date && r.due_date < today && r.status !== "completed" ? "text-danger" : ""}>{formatDate(r.due_date)}</span> },
            { key: "st", header: "Status", cell: (r) => <span className="flex gap-1"><StatusBadge status={r.status} label={FILE_STATUS_LABELS[r.status]} />{r.priority === "urgent" && <StatusBadge status="urgent" />}</span> },
            { key: "u", header: "Updated", cell: (r) => relativeTime(r.updated_at), mobileHidden: true },
          ]} />
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={qs} />
      </Card>
    </>
  );
}
