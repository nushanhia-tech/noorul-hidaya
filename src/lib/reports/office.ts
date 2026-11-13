import "server-only";
import { createClient } from "@/lib/supabase/server";
import { collectionTotals } from "@/lib/fees";
import { FILE_CATEGORIES, FILE_STATUS_LABELS, TASK_STATUS_LABELS, TICKET_CATEGORIES, TICKET_STATUS_LABELS } from "@/lib/constants";

export type ReportKind = "overview" | "financial" | "files" | "tasks" | "correspondence" | "helpdesk";
export type Table = { title: string; headers: string[]; rows: (string | number)[][]; align?: ("left" | "right")[] };
export type Report = { kind: ReportKind; title: string; from: string; to: string; stats: { label: string; value: string | number }[]; chart?: { title: string; data: Record<string, string | number>[]; x: string; y: string; money?: boolean }; tables: Table[] };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const hrs = (ms: number) => (ms < 3600000 ? `${Math.round(ms / 60000)} min` : `${(ms / 3600000).toFixed(1)} h`);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
function countBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
}
const monthKey = (iso: string) => iso.slice(0, 7);

/** Builds an office report from live records. All figures are computed from the database; nothing is estimated. */
export async function buildOfficeReport(kind: ReportKind, from: string, to: string): Promise<Report> {
  const db = await createClient();
  const range = <Q extends { gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q }>(q: Q, col: string) => q.gte(col, `${from}T00:00:00`).lte(col, `${to}T23:59:59.999`);
  const base = { kind, from, to };

  if (kind === "financial") {
    const [{ data: pays }, { data: bal }] = await Promise.all([
      range(db.from("payments").select("amount, status, mode, method, paid_at").eq("status", "verified"), "paid_at"),
      db.from("invoice_balances").select("outstanding, status"),
    ]);
    const t = collectionTotals((pays ?? []) as never);
    const byMonth = new Map<string, number>();
    for (const [d, v] of Object.entries(t.byDay)) byMonth.set(monthKey(d), (byMonth.get(monthKey(d)) ?? 0) + v);
    const out = (bal ?? []).filter((b) => Number(b.outstanding) > 0);
    return { ...base, title: "Financial summary", stats: [
      { label: "Collected", value: inr(t.total) }, { label: "Payments", value: t.count },
      { label: "Outstanding now", value: inr(out.reduce((s, b) => s + Number(b.outstanding), 0)) }, { label: "Overdue invoices", value: out.filter((b) => b.status === "overdue").length },
    ], chart: { title: "Collection by month", data: [...byMonth.entries()].sort().map(([m, v]) => ({ month: m, amount: v })), x: "month", y: "amount", money: true },
    tables: [{ title: "By payment method", headers: ["Method", "Amount", "Share"], rows: Object.entries(t.byMethod).map(([m, v]) => [m, inr(v), pct(v, t.total)]), align: ["left", "right", "right"] }] };
  }

  if (kind === "files") {
    const { data } = await range(db.from("office_files").select("status, category, created_at, completed_at, due_date, office_sections(name), departments(name)"), "created_at");
    const rows = (data ?? []) as unknown as { status: string; category: string; created_at: string; completed_at: string | null; due_date: string | null; office_sections: { name: string } | null; departments: { name: string } | null }[];
    const done = rows.filter((r) => r.completed_at);
    const today = new Date().toISOString().slice(0, 10);
    const bySection = countBy(rows, (r) => r.office_sections?.name ?? "Unassigned");
    const byDept = countBy(rows, (r) => r.departments?.name ?? "—");
    return { ...base, title: "File processing", stats: [
      { label: "Files opened", value: rows.length }, { label: "Completed", value: done.length },
      { label: "Pending", value: rows.filter((r) => !["completed", "archived"].includes(r.status)).length },
      { label: "Avg. time to complete", value: done.length ? hrs(avg(done.map((r) => new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime()))) : "—" },
      { label: "Overdue", value: rows.filter((r) => r.due_date && r.due_date < today && !["completed", "archived"].includes(r.status)).length },
    ], chart: { title: "Files by status", data: Object.keys(FILE_STATUS_LABELS).map((s) => ({ status: FILE_STATUS_LABELS[s], files: rows.filter((r) => r.status === s).length })), x: "status", y: "files" },
    tables: [
      { title: "By category", headers: ["Category", "Files"], rows: [...countBy(rows, (r) => r.category).entries()].map(([k, v]) => [FILE_CATEGORIES[k as keyof typeof FILE_CATEGORIES] ?? k, v]), align: ["left", "right"] },
      { title: "Workload by section", headers: ["Section", "Files"], rows: [...bySection.entries()].sort((a, b) => b[1] - a[1]), align: ["left", "right"] },
      { title: "Department-wise workload", headers: ["Department", "Files"], rows: [...byDept.entries()].sort((a, b) => b[1] - a[1]), align: ["left", "right"] },
    ] };
  }

  if (kind === "tasks") {
    const { data } = await range(db.from("office_tasks").select("status, due_on, created_at, completed_at, assignee:profiles!office_tasks_assigned_to_fkey(full_name)"), "created_at");
    const rows = (data ?? []) as unknown as { status: string; due_on: string | null; created_at: string; completed_at: string | null; assignee: { full_name: string } | null }[];
    const people = new Map<string, { total: number; done: number; onTime: number; overdue: number }>();
    const today = new Date().toISOString().slice(0, 10);
    for (const r of rows) {
      const k = r.assignee?.full_name ?? "Unassigned";
      const p = people.get(k) ?? { total: 0, done: 0, onTime: 0, overdue: 0 };
      p.total++;
      if (r.status === "completed") { p.done++; if (!r.due_on || r.completed_at!.slice(0, 10) <= r.due_on) p.onTime++; }
      else if (r.status !== "cancelled" && r.due_on && r.due_on < today) p.overdue++;
      people.set(k, p);
    }
    const completed = rows.filter((r) => r.status === "completed");
    return { ...base, title: "Staff task completion", stats: [
      { label: "Tasks created", value: rows.length }, { label: "Completed", value: completed.length },
      { label: "Completion rate", value: pct(completed.length, rows.filter((r) => r.status !== "cancelled").length) },
      { label: "Overdue open tasks", value: [...people.values()].reduce((s, p) => s + p.overdue, 0) },
    ], chart: { title: "Tasks by status", data: Object.keys(TASK_STATUS_LABELS).map((s) => ({ status: TASK_STATUS_LABELS[s], tasks: rows.filter((r) => r.status === s).length })), x: "status", y: "tasks" },
    tables: [{ title: "By staff member", headers: ["Staff", "Assigned", "Completed", "On time", "Overdue"], rows: [...people.entries()].map(([k, p]) => [k, p.total, p.done, pct(p.onTime, p.done), p.overdue]), align: ["left", "right", "right", "right", "right"] }] };
  }

  if (kind === "correspondence") {
    const { data } = await db.from("letters").select("direction, status, mode, letter_date, departments(name)").gte("letter_date", from).lte("letter_date", to);
    const rows = (data ?? []) as unknown as { direction: string; status: string; mode: string | null; letter_date: string; departments: { name: string } | null }[];
    const months = [...new Set(rows.map((r) => monthKey(r.letter_date)))].sort();
    return { ...base, title: "Letters & dispatch", stats: [
      { label: "Inward letters", value: rows.filter((r) => r.direction === "inward").length }, { label: "Outward letters", value: rows.filter((r) => r.direction === "outward").length },
      { label: "Dispatched / delivered", value: rows.filter((r) => ["dispatched", "delivered"].includes(r.status)).length }, { label: "Returned", value: rows.filter((r) => r.status === "returned").length },
    ], chart: { title: "Letters per month", data: months.map((m) => ({ month: m, letters: rows.filter((r) => monthKey(r.letter_date) === m).length })), x: "month", y: "letters" },
    tables: [
      { title: "By status", headers: ["Direction", "Status", "Letters"], rows: [...countBy(rows, (r) => `${r.direction}|${r.status}`).entries()].map(([k, v]) => [...k.split("|"), v]), align: ["left", "left", "right"] },
      { title: "By dispatch mode", headers: ["Mode", "Letters"], rows: [...countBy(rows.filter((r) => r.mode), (r) => r.mode!).entries()], align: ["left", "right"] },
      { title: "By department", headers: ["Department", "Letters"], rows: [...countBy(rows, (r) => r.departments?.name ?? "—").entries()], align: ["left", "right"] },
    ] };
  }

  if (kind === "helpdesk") {
    const { data } = await range(db.from("tickets").select("status, category, created_at, first_response_at, resolved_at, reopened_count"), "created_at");
    const rows = (data ?? []) as { status: string; category: string; created_at: string; first_response_at: string | null; resolved_at: string | null; reopened_count: number }[];
    const responded = rows.filter((r) => r.first_response_at);
    const resolved = rows.filter((r) => r.resolved_at);
    return { ...base, title: "Help desk resolution", stats: [
      { label: "Tickets received", value: rows.length }, { label: "Resolved", value: resolved.length },
      { label: "Avg. first response", value: responded.length ? hrs(avg(responded.map((r) => new Date(r.first_response_at!).getTime() - new Date(r.created_at).getTime()))) : "—" },
      { label: "Avg. resolution time", value: resolved.length ? hrs(avg(resolved.map((r) => new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()))) : "—" },
      { label: "Reopened", value: rows.filter((r) => r.reopened_count > 0).length },
    ], chart: { title: "Tickets by category", data: Object.keys(TICKET_CATEGORIES).map((c) => ({ category: TICKET_CATEGORIES[c as keyof typeof TICKET_CATEGORIES].replace("Student ", ""), tickets: rows.filter((r) => r.category === c).length })), x: "category", y: "tickets" },
    tables: [{ title: "By status", headers: ["Status", "Tickets"], rows: Object.keys(TICKET_STATUS_LABELS).map((s) => [TICKET_STATUS_LABELS[s], rows.filter((r) => r.status === s).length]), align: ["left", "right"] }] };
  }

  // overview
  const [f, t, l, h] = await Promise.all([buildOfficeReport("files", from, to), buildOfficeReport("tasks", from, to), buildOfficeReport("correspondence", from, to), buildOfficeReport("helpdesk", from, to)]);
  return { ...base, title: "Office overview", stats: [f.stats[0], f.stats[2], t.stats[1], t.stats[2], l.stats[0], l.stats[1], h.stats[0], h.stats[2]], tables: [f.tables[1], f.tables[2]] };
}
