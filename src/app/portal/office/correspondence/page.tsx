import { Download, Inbox, Plus, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, EmptyState, Tabs, StatCard, Pagination } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Correspondence" };
const PAGE = 30;

export default async function Correspondence({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; status?: string; department?: string; from?: string; to?: string; page?: string }> }) {
  const user = await requirePortal("office");
  const sp = await searchParams;
  const view = sp.view ?? "inward";
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await createClient();
  let q = db.from("letters").select("id, reference_no, direction, external_ref, subject, sender_name, recipient_name, letter_date, received_on, dispatched_on, mode, tracking_no, status, acknowledged_at, departments(name)", { count: "exact" });
  if (view === "archive") q = q.not("archived_at", "is", null);
  else {
    q = q.is("archived_at", null);
    if (view === "dispatch") q = q.eq("direction", "outward").in("status", ["ready", "dispatched", "returned"]);
    else q = q.eq("direction", view === "outward" ? "outward" : "inward");
  }
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.department) q = q.eq("department_id", sp.department);
  if (sp.from) q = q.gte("letter_date", sp.from);
  if (sp.to) q = q.lte("letter_date", sp.to);
  if (sp.q) { const t = sp.q.replace(/[%_,()]/g, ""); q = q.or(`reference_no.ilike.%${t}%,subject.ilike.%${t}%,sender_name.ilike.%${t}%,recipient_name.ilike.%${t}%,external_ref.ilike.%${t}%`); }
  const [{ data, count }, { data: all }, { data: depts }] = await Promise.all([
    q.order("letter_date", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    db.from("letters").select("direction, status, archived_at"),
    db.from("departments").select("id, name").order("name"),
  ]);
  type L = { id: string; reference_no: string; direction: string; external_ref: string | null; subject: string; sender_name: string | null; recipient_name: string | null; letter_date: string; received_on: string | null; dispatched_on: string | null; mode: string | null; tracking_no: string | null; status: string; acknowledged_at: string | null; departments: { name: string } | null };
  const live = (all ?? []).filter((l) => !l.archived_at);
  const qs = (p: number) => `/portal/office/correspondence?${new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  const inward = view === "inward";
  return (
    <>
      <PageHeader title="Correspondence" description="Inward and outward registers with dispatch tracking."
        actions={<>
          <a href="/api/export/letters" className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> CSV</a>
          {can(user, "letters.manage") && <><LinkButton variant="outline" href="/portal/office/correspondence/new?direction=inward"><Inbox className="h-4 w-4" /> Register inward</LinkButton><LinkButton href="/portal/office/correspondence/new?direction=outward"><Plus className="h-4 w-4" /> New letter</LinkButton></>}
        </>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Inward — awaiting action" value={live.filter((l) => l.direction === "inward" && l.status !== "closed").length} icon={Inbox} tone="royal" />
        <StatCard label="Outward drafts" value={live.filter((l) => l.direction === "outward" && l.status === "draft").length} />
        <StatCard label="Ready to dispatch" value={live.filter((l) => l.status === "ready").length} icon={Send} tone="accent" href="/portal/office/correspondence?view=dispatch" />
        <StatCard label="Returned undelivered" value={live.filter((l) => l.status === "returned").length} tone="danger" />
      </div>
      <Tabs active={`/portal/office/correspondence?view=${view}`} items={[
        { href: "/portal/office/correspondence?view=inward", label: "Inward register" }, { href: "/portal/office/correspondence?view=outward", label: "Outward register" },
        { href: "/portal/office/correspondence?view=dispatch", label: "Dispatch tracking" }, { href: "/portal/office/correspondence?view=archive", label: "Archive" },
        { href: "/portal/office/correspondence/templates", label: "Templates" },
      ]} />
      <FilterBar q={sp.q} placeholder="Reference, subject, sender or recipient" className="mb-4" hidden={{ view }}>
        <input type="date" name="from" defaultValue={sp.from} aria-label="From date" className="h-10 rounded-sm border border-line-strong bg-white px-3 text-sm" />
        <input type="date" name="to" defaultValue={sp.to} aria-label="To date" className="h-10 rounded-sm border border-line-strong bg-white px-3 text-sm" />
        <FilterSelect name="status" value={sp.status} label="Status" options={(inward ? ["received", "under_action", "closed"] : ["draft", "ready", "dispatched", "delivered", "returned"]).map((s) => ({ value: s, label: s.replace("_", " ") }))} />
        <FilterSelect name="department" value={sp.department} label="Department" options={(depts ?? []).map((d) => ({ value: d.id, label: d.name }))} />
      </FilterBar>
      <Card>
        <DataTable rows={(data ?? []) as unknown as L[]} rowKey={(r) => r.id} rowHref={(r) => `/portal/office/correspondence/${r.id}`} empty={<EmptyState title="No letters found" />}
          columns={[
            { key: "s", header: "Subject", primary: true, cell: (r) => r.subject },
            { key: "r", header: "Reference", cell: (r) => <span className="tabular">{r.reference_no}</span> },
            { key: "p", header: inward ? "From" : "To", cell: (r) => (r.direction === "inward" ? r.sender_name : r.recipient_name) },
            { key: "d", header: inward ? "Received" : "Letter date", cell: (r) => formatDate(r.direction === "inward" ? r.received_on : r.letter_date) },
            ...(view === "dispatch" ? [{ key: "t", header: "Tracking", cell: (r: L) => r.tracking_no ?? "—" }] : []),
            { key: "st", header: "Status", cell: (r) => <span className="flex gap-1"><StatusBadge status={r.status} />{r.acknowledged_at && <StatusBadge status="approved" label="Ack." />}</span> },
          ]} />
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={qs} />
      </Card>
    </>
  );
}
