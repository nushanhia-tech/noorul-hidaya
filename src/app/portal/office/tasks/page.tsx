import { KanbanSquare, LayoutList, Plus, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { staffOptions } from "@/lib/data/lookups";
import { PageHeader, EmptyState, Tabs, StatCard } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TaskBoard, type BoardTask } from "./board";

export const metadata = { title: "Office Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; layout?: string; q?: string; assignee?: string; priority?: string; overdue?: string }> }) {
  const user = await requirePortal("office");
  const sp = await searchParams;
  const canAll = can(user, "tasks.view_all");
  const view = sp.view ?? (canAll ? "all" : "mine");
  const layout = sp.layout === "board" ? "board" : "list";
  const today = todayISO();
  const db = await createClient();
  let q = db.from("office_tasks").select("id, title, status, priority, due_on, completed_at, created_at, assigned_to, assignee:profiles!office_tasks_assigned_to_fkey(full_name), creator:profiles!office_tasks_created_by_fkey(full_name)").order("due_on", { ascending: true, nullsFirst: false });
  if (view === "mine") q = q.eq("assigned_to", user.id);
  if (view === "completed") q = q.in("status", ["completed", "cancelled"]); else if (layout === "list") q = q.in("status", ["todo", "in_progress", "waiting"]);
  if (sp.assignee) q = q.eq("assigned_to", sp.assignee);
  if (sp.priority) q = q.eq("priority", sp.priority);
  if (sp.overdue) q = q.lt("due_on", today);
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_]/g, "")}%`);
  const [{ data }, staff, { data: mine }] = await Promise.all([q.limit(300), staffOptions(), db.from("office_tasks").select("status, due_on").eq("assigned_to", user.id)]);
  type T = { id: string; title: string; status: string; priority: string; due_on: string | null; completed_at: string | null; assignee: { full_name: string } | null; creator: { full_name: string } | null };
  const rows = (data ?? []) as unknown as T[];
  const open = (mine ?? []).filter((t) => ["todo", "in_progress", "waiting"].includes(t.status));
  const base = `/portal/office/tasks?view=${view}`;
  return (
    <>
      <PageHeader title="Office tasks" description="Work assigned to office staff — with deadlines, priorities and a full history."
        actions={<><a href="/api/export/tasks" className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> CSV</a><LinkButton href="/portal/office/tasks/new"><Plus className="h-4 w-4" /> New task</LinkButton></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="My open tasks" value={open.length} tone="royal" />
        <StatCard label="My overdue" value={open.filter((t) => t.due_on && t.due_on < today).length} tone="danger" href="/portal/office/tasks?view=mine&overdue=1" />
        <StatCard label="Due today" value={open.filter((t) => t.due_on === today).length} tone="accent" />
        <StatCard label="I completed" value={(mine ?? []).filter((t) => t.status === "completed").length} tone="teal" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Tabs active={`/portal/office/tasks?view=${view}`} items={[
          { href: "/portal/office/tasks?view=mine", label: "My tasks" },
          ...(canAll ? [{ href: "/portal/office/tasks?view=all", label: "All assigned tasks" }] : []),
          { href: "/portal/office/tasks?view=completed", label: "Completed" },
        ]} />
        {view !== "completed" && (
          <div className="mb-5 inline-flex shrink-0 rounded-sm border border-line bg-paper p-0.5" role="group" aria-label="Layout">
            <a href={`${base}&layout=list`} className={cn("inline-flex items-center gap-1.5 rounded-xs px-3 py-1.5 text-sm", layout === "list" && "bg-ink text-white")}><LayoutList className="h-4 w-4" /> List</a>
            <a href={`${base}&layout=board`} className={cn("inline-flex items-center gap-1.5 rounded-xs px-3 py-1.5 text-sm", layout === "board" && "bg-ink text-white")}><KanbanSquare className="h-4 w-4" /> Board</a>
          </div>
        )}
      </div>
      <FilterBar q={sp.q} placeholder="Search tasks" className="mb-4" hidden={{ view, layout: sp.layout }}>
        {canAll && view !== "mine" && <FilterSelect name="assignee" value={sp.assignee} label="Assignee" options={staff} />}
        <FilterSelect name="priority" value={sp.priority} label="Priority" options={["urgent", "high", "normal", "low"].map((p) => ({ value: p, label: p }))} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="overdue" value="1" defaultChecked={!!sp.overdue} /> Overdue only</label>
      </FilterBar>
      {layout === "board" && view !== "completed" ? (
        <TaskBoard today={today} tasks={rows.filter((r) => r.status !== "cancelled").map((r): BoardTask => ({ id: r.id, title: r.title, status: r.status, priority: r.priority, due_on: r.due_on, assignee: view === "mine" ? null : r.assignee?.full_name ?? null }))} />
      ) : (
        <Card>
          <DataTable rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/portal/office/tasks/${r.id}`} empty={<EmptyState icon={KanbanSquare} title="No tasks" />}
            columns={[
              { key: "t", header: "Task", primary: true, cell: (r) => r.title },
              { key: "a", header: "Assigned to", cell: (r) => r.assignee?.full_name ?? "—" },
              { key: "p", header: "Priority", cell: (r) => <StatusBadge status={r.priority} /> },
              { key: "d", header: view === "completed" ? "Completed" : "Due", cell: (r) => view === "completed" ? formatDate(r.completed_at) : <span className={r.due_on && r.due_on < today ? "font-medium text-danger" : ""}>{formatDate(r.due_on)}</span> },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} label={TASK_STATUS_LABELS[r.status]} /> },
              { key: "c", header: "From", cell: (r) => r.creator?.full_name ?? "—", mobileHidden: true },
            ]} />
        </Card>
      )}
    </>
  );
}
