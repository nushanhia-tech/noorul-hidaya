import Link from "next/link";
import { AlertTriangle, FileText, FolderOpen, KanbanSquare, LifeBuoy, Mail, Search, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard, EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { SimpleBarChart } from "@/components/charts";
import { formatMoney, collectionTotals } from "@/lib/fees";
import { daysFromNow, formatDate, greeting, relativeTime, todayISO } from "@/lib/format";
import { FILE_STATUS_LABELS } from "@/lib/constants";

export const metadata = { title: "Office Dashboard" };

export default async function OfficeDashboard() {
  const user = await requirePortal("office");
  const db = await createClient();
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const finance = can(user, "finance.view");
  const [files, myTasks, tickets, letters, activity, payments, outstanding, deadlines] = await Promise.all([
    can(user, ["files.manage", "files.view_all"]) ? db.from("office_files").select("status") : Promise.resolve({ data: [] as { status: string }[] }),
    db.from("office_tasks").select("id, title, status, priority, due_on").eq("assigned_to", user.id).in("status", ["todo", "in_progress", "waiting"]).order("due_on", { nullsFirst: false }).limit(6),
    can(user, "helpdesk.handle") ? db.from("tickets").select("id, ticket_no, subject, status, created_at, assigned_to").not("status", "in", "(resolved,closed)").order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    can(user, "letters.view") ? db.from("letters").select("id, reference_no, direction, subject, status, created_at").order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    can(user, ["files.manage", "files.view_all"]) ? db.from("file_movements").select("id, action, note, created_at, to_status, office_files(id, reference_no, subject), actor:profiles!file_movements_actor_id_fkey(full_name)").order("created_at", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    finance ? db.from("payments").select("amount, status, mode, method, paid_at").eq("status", "verified").gte("paid_at", `${monthStart}T00:00:00`) : Promise.resolve({ data: [] }),
    finance ? db.from("invoice_balances").select("outstanding").gt("outstanding", 0) : Promise.resolve({ data: [] }),
    db.from("office_files").select("id, reference_no, subject, due_date").not("status", "in", "(completed,archived)").not("due_date", "is", null).lte("due_date", daysFromNow(7)).order("due_date").limit(5),
  ]);
  const fileList = (files.data ?? []) as { status: string }[];
  const fc = (s: string[]) => fileList.filter((f) => s.includes(f.status)).length;
  const ticketList = (tickets.data ?? []) as { id: string; ticket_no: string; subject: string; status: string; created_at: string; assigned_to: string | null }[];
  const coll = collectionTotals((payments.data ?? []) as never);
  const todayColl = collectionTotals(((payments.data ?? []) as { paid_at: string }[]).filter((p) => p.paid_at?.startsWith(today)) as never);
  const totalOutstanding = ((outstanding.data ?? []) as { outstanding: number }[]).reduce((s, r) => s + Number(r.outstanding), 0);
  const byDay = Object.entries(coll.byDay).sort().map(([d, v]) => ({ day: d.slice(8), amount: v }));
  const fileChart = ["new", "assigned", "in_progress", "waiting_info", "completed"].map((s) => ({ status: FILE_STATUS_LABELS[s].replace(" for information", ""), files: fc([s]) }));

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{greeting()}, {user.fullName.split(" ")[0]}</p>
          <h1 className="font-display text-[28px] font-semibold tracking-tight sm:text-[32px]">Office dashboard</h1>
        </div>
        {can(user, "students.lookup") && (
          <form action="/portal/office/students" className="relative w-full sm:w-80" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input name="q" type="search" placeholder="Quick student search — name or register no." aria-label="Quick student search" className="h-11 w-full rounded-sm border border-line-strong bg-white pl-9 pr-3 text-sm focus:border-royal focus:outline-none" />
          </form>
        )}
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Office files (open)" value={fc(["new", "assigned", "in_progress", "waiting_info"])} hint={`${fc(["new"])} new · ${fc(["completed"])} completed`} icon={FolderOpen} tone="accent" href="/portal/office/files" />
        <StatCard label="My open tasks" value={myTasks.data?.length ?? 0} hint={`${(myTasks.data ?? []).filter((t) => t.due_on && t.due_on < today).length} overdue`} icon={KanbanSquare} tone="royal" href="/portal/office/tasks" />
        <StatCard label="Help desk (open)" value={ticketList.length} hint={`${ticketList.filter((t) => !t.assigned_to).length} unassigned`} icon={LifeBuoy} tone="plum" href="/portal/office/helpdesk" />
        {finance
          ? <StatCard label="Collected this month" value={formatMoney(coll.total)} hint={`Today ${formatMoney(todayColl.total)} · Outstanding ${formatMoney(totalOutstanding)}`} icon={Wallet} tone="teal" href="/portal/office/accounts" />
          : <StatCard label="Files in progress" value={fc(["in_progress"])} icon={FileText} />}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {finance && (
            <Card>
              <CardHeader title="Fee collection this month" description="Verified live payments only (sandbox tests excluded)" />
              <CardBody>{byDay.length ? <SimpleBarChart data={byDay} x="day" y="amount" name="Collected" format="money" /> : <EmptyState title="No collections yet this month" />}</CardBody>
            </Card>
          )}
          {fileList.length > 0 && (
            <Card><CardHeader title="Files by status" /><CardBody><SimpleBarChart data={fileChart} x="status" y="files" name="Files" color="#4a4ddb" /></CardBody></Card>
          )}
          <Card>
            <CardHeader title="Recent office activity" />
            {(activity.data ?? []).length === 0 ? <EmptyState title="No activity yet" /> : (
              <ul className="divide-y divide-line">
                {((activity.data ?? []) as unknown as { id: number; action: string; note: string | null; created_at: string; to_status: string | null; office_files: { id: string; reference_no: string; subject: string }; actor: { full_name: string } | null }[]).map((a) => (
                  <li key={a.id}><Link href={`/portal/office/files/${a.office_files.id}`} className="block px-5 py-3 hover:bg-white">
                    <span className="text-sm"><span className="font-medium">{a.actor?.full_name ?? "System"}</span> {a.action.replace("_", " ")} <span className="tabular">{a.office_files.reference_no}</span>{a.to_status && ` → ${FILE_STATUS_LABELS[a.to_status]}`}</span>
                    <span className="block text-xs text-muted">{a.office_files.subject} · {relativeTime(a.created_at)}</span>
                  </Link></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="My tasks" action={<Link href="/portal/office/tasks?view=mine" className="text-[13px] font-medium text-royal hover:underline">All</Link>} />
            {(myTasks.data ?? []).length === 0 ? <EmptyState icon={KanbanSquare} title="No open tasks" /> : (
              <ul className="divide-y divide-line">{(myTasks.data ?? []).map((t) => (
                <li key={t.id}><Link href={`/portal/office/tasks/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{t.title}</span><span className={`text-xs ${t.due_on && t.due_on < today ? "text-danger" : "text-muted"}`}>{t.due_on ? `Due ${formatDate(t.due_on)}` : "No deadline"}</span></span>
                  <StatusBadge status={t.status} />
                </Link></li>
              ))}</ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Important deadlines" description="Files due within 7 days" />
            {(deadlines.data ?? []).length === 0 ? <EmptyState title="Nothing due soon" /> : (
              <ul className="divide-y divide-line">{(deadlines.data ?? []).map((f) => (
                <li key={f.id}><Link href={`/portal/office/files/${f.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-white">
                  {f.due_date! < today && <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />}
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{f.subject}</span><span className="tabular text-xs text-muted">{f.reference_no}</span></span>
                  <span className="tabular shrink-0 text-xs">{formatDate(f.due_date)}</span>
                </Link></li>
              ))}</ul>
            )}
          </Card>
          {can(user, "helpdesk.handle") && (
            <Card>
              <CardHeader title="Help desk tickets" action={<Link href="/portal/office/helpdesk" className="text-[13px] font-medium text-royal hover:underline">Open desk</Link>} />
              {ticketList.length === 0 ? <EmptyState icon={LifeBuoy} title="No open tickets" /> : (
                <ul className="divide-y divide-line">{ticketList.slice(0, 5).map((t) => (
                  <li key={t.id}><Link href={`/portal/office/helpdesk/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{t.subject}</span><span className="tabular text-xs text-muted">{t.ticket_no} · {relativeTime(t.created_at)}</span></span><StatusBadge status={t.status} />
                  </Link></li>
                ))}</ul>
              )}
            </Card>
          )}
          {can(user, "letters.view") && (
            <Card>
              <CardHeader title="Recent letters" action={<Link href="/portal/office/correspondence" className="text-[13px] font-medium text-royal hover:underline">Registers</Link>} />
              {(letters.data ?? []).length === 0 ? <EmptyState icon={Mail} title="No letters registered" /> : (
                <ul className="divide-y divide-line">{(letters.data ?? []).map((l) => (
                  <li key={l.id}><Link href={`/portal/office/correspondence/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{l.subject}</span><span className="tabular text-xs text-muted">{l.reference_no}</span></span><StatusBadge status={l.status} />
                  </Link></li>
                ))}</ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
