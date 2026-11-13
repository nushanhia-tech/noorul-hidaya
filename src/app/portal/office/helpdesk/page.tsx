import { Download, LifeBuoy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, EmptyState, Tabs, StatCard, Pagination } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { TICKET_CATEGORIES, TICKET_STATUS_LABELS, type TicketCategory } from "@/lib/constants";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Help Desk" };
const PAGE = 30;

function hours(a: string, b: string | null) {
  if (!b) return null;
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}

export default async function HelpdeskPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; status?: string; category?: string; priority?: string; page?: string }> }) {
  const user = await requirePortal("office");
  const sp = await searchParams;
  const view = sp.view ?? (can(user, "helpdesk.view_all") ? "all" : "assigned");
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await createClient();
  let q = db.from("tickets").select("id, ticket_no, subject, category, status, priority, created_at, updated_at, first_response_at, assigned_to, escalated_to, requester:profiles!tickets_requester_id_fkey(full_name), assignee:profiles!tickets_assigned_to_fkey(full_name)", { count: "exact" }).order("updated_at", { ascending: false });
  if (view === "assigned") q = q.or(`assigned_to.eq.${user.id},escalated_to.eq.${user.id}`).not("status", "in", "(resolved,closed)");
  else if (view === "resolved") q = q.in("status", ["resolved", "closed"]);
  else if (view === "unassigned") q = q.is("assigned_to", null).not("status", "in", "(resolved,closed)");
  else q = q.not("status", "in", "(resolved,closed)");
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.category) q = q.eq("category", sp.category);
  if (sp.priority) q = q.eq("priority", sp.priority);
  if (sp.q) { const t = sp.q.replace(/[%_,()]/g, ""); q = q.or(`ticket_no.ilike.%${t}%,subject.ilike.%${t}%`); }
  const [{ data, count }, { data: stats }] = await Promise.all([q.range((page - 1) * PAGE, page * PAGE - 1), db.from("tickets").select("status, created_at, first_response_at, resolved_at, assigned_to")]);
  const s = stats ?? [];
  const open = s.filter((t) => !["resolved", "closed"].includes(t.status));
  const resp = s.map((t) => hours(t.created_at, t.first_response_at)).filter((h): h is number => h !== null);
  const avgResp = resp.length ? resp.reduce((a, b) => a + b, 0) / resp.length : null;
  type T = { id: string; ticket_no: string; subject: string; category: string; status: string; priority: string; created_at: string; updated_at: string; escalated_to: string | null; requester: { full_name: string }; assignee: { full_name: string } | null };
  const qs = (p: number) => `/portal/office/helpdesk?${new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <PageHeader title="Student help desk" description="Requests from students — certificates, receipts, record corrections and more."
        actions={<a href="/api/export/tickets" className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> CSV</a>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open tickets" value={open.length} tone="royal" />
        <StatCard label="Unassigned" value={open.filter((t) => !t.assigned_to).length} tone="accent" href="/portal/office/helpdesk?view=unassigned" />
        <StatCard label="Waiting for student" value={s.filter((t) => t.status === "waiting_student").length} />
        <StatCard label="Avg. first response" value={avgResp === null ? "—" : avgResp < 1 ? `${Math.round(avgResp * 60)} min` : `${avgResp.toFixed(1)} h`} tone="teal" />
      </div>
      <Tabs active={`/portal/office/helpdesk?view=${view}`} items={[
        ...(can(user, "helpdesk.view_all") ? [{ href: "/portal/office/helpdesk?view=all", label: "All open" }, { href: "/portal/office/helpdesk?view=unassigned", label: "Unassigned" }] : []),
        { href: "/portal/office/helpdesk?view=assigned", label: "Assigned to me" },
        { href: "/portal/office/helpdesk?view=resolved", label: "Resolved" },
      ]} />
      <FilterBar q={sp.q} placeholder="Ticket number or subject" className="mb-4" hidden={{ view }}>
        <FilterSelect name="category" value={sp.category} label="Category" options={Object.entries(TICKET_CATEGORIES).map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="status" value={sp.status} label="Status" options={Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="priority" value={sp.priority} label="Priority" options={["urgent", "high", "normal", "low"].map((p) => ({ value: p, label: p }))} />
      </FilterBar>
      <Card>
        <DataTable rows={(data ?? []) as unknown as T[]} rowKey={(r) => r.id} rowHref={(r) => `/portal/office/helpdesk/${r.id}`} empty={<EmptyState icon={LifeBuoy} title="No tickets" />}
          columns={[
            { key: "s", header: "Subject", primary: true, cell: (r) => r.subject },
            { key: "n", header: "Ticket", cell: (r) => <span className="tabular">{r.ticket_no}</span> },
            { key: "r", header: "Student", cell: (r) => r.requester.full_name },
            { key: "c", header: "Category", cell: (r) => TICKET_CATEGORIES[r.category as TicketCategory], mobileHidden: true },
            { key: "a", header: "Assigned", cell: (r) => r.assignee?.full_name ?? <span className="text-accent-700">Unassigned</span> },
            { key: "st", header: "Status", cell: (r) => <span className="flex gap-1"><StatusBadge status={r.status} label={TICKET_STATUS_LABELS[r.status]} />{r.priority !== "normal" && <StatusBadge status={r.priority} />}{r.escalated_to && <StatusBadge status="urgent" label="Escalated" />}</span> },
            { key: "u", header: "Updated", cell: (r) => relativeTime(r.updated_at), mobileHidden: true },
          ]} />
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={qs} />
      </Card>
    </>
  );
}
