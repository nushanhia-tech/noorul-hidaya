import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, can } from "@/lib/auth/session";
import { toCsv, csvResponse } from "@/lib/csv";
import { todayISO } from "@/lib/format";
import type { Permission } from "@/lib/auth/permissions";

/**
 * CSV exports. Every query runs with the caller's session, so RLS limits rows
 * to what they may see; the permission check here gives a clear 403 first.
 */
type Ctx = { sp: URLSearchParams; db: Awaited<ReturnType<typeof createClient>> };
type Report = { permission?: Permission | Permission[]; run: (c: Ctx) => Promise<{ name: string; headers: string[]; rows: (string | number | null)[][] }> };

const range = (sp: URLSearchParams) => ({
  from: sp.get("from") || `${todayISO().slice(0, 7)}-01`,
  to: sp.get("to") || todayISO(),
});

const REPORTS: Record<string, Report> = {
  "class-list": {
    run: async ({ sp, db }) => {
      const { data } = await db.from("enrolments").select("students(register_no, profiles(full_name, email))").eq("offering_id", sp.get("offering") ?? "");
      const rows = (data ?? []).map((e) => e.students as unknown as { register_no: string; profiles: { full_name: string; email: string } })
        .sort((a, b) => a.register_no.localeCompare(b.register_no)).map((s) => [s.register_no, s.profiles.full_name, s.profiles.email]);
      return { name: "class-list", headers: ["Register no", "Name", "Email"], rows };
    },
  },
  "course-results": {
    run: async ({ sp, db }) => {
      const { data } = await db.from("results").select("marks, max_marks, percentage, grade, passed, is_absent, students(register_no, profiles(full_name))")
        .eq("offering_id", sp.get("offering") ?? "").eq("exam_id", sp.get("exam") ?? "");
      const rows = (data ?? []).map((r) => {
        const s = r.students as unknown as { register_no: string; profiles: { full_name: string } };
        return [s.register_no, s.profiles.full_name, r.is_absent ? "AB" : Number(r.marks), Number(r.max_marks), r.percentage === null ? "" : Number(r.percentage), r.grade, r.passed ? "Pass" : "Fail"];
      }).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      return { name: "course-results", headers: ["Register no", "Name", "Marks", "Max", "Percent", "Grade", "Result"], rows };
    },
  },
  payments: {
    permission: "finance.view",
    run: async ({ sp, db }) => {
      const { from, to } = range(sp);
      const { data } = await db.from("payments").select("paid_at, amount, method, mode, status, reference_no, provider_payment_id, receipts(receipt_no), invoices(invoice_no, title), students(register_no, profiles(full_name))")
        .eq("status", "verified").eq("mode", "live").gte("paid_at", `${from}T00:00:00`).lte("paid_at", `${to}T23:59:59.999`).order("paid_at");
      const rows = (data ?? []).map((p) => {
        const s = p.students as unknown as { register_no: string; profiles: { full_name: string } };
        const inv = p.invoices as unknown as { invoice_no: string; title: string };
        const rc = p.receipts as unknown as { receipt_no: string } | { receipt_no: string }[] | null;
        return [p.paid_at, Array.isArray(rc) ? rc[0]?.receipt_no ?? "" : rc?.receipt_no ?? "", s.register_no, s.profiles.full_name, inv.invoice_no, inv.title, p.method, Number(p.amount), p.reference_no ?? p.provider_payment_id ?? ""];
      });
      return { name: `collections_${from}_${to}`, headers: ["Paid at", "Receipt", "Register no", "Student", "Invoice", "Fee", "Method", "Amount", "Reference"], rows };
    },
  },
  outstanding: {
    permission: "finance.view",
    run: async ({ db }) => {
      const { data } = await db.from("invoice_balances").select("invoice_no, title, amount, paid_total, concession_total, outstanding, due_date, status, students(register_no, profiles(full_name))").gt("outstanding", 0).order("due_date");
      const rows = (data ?? []).map((b) => {
        const s = b.students as unknown as { register_no: string; profiles: { full_name: string } };
        return [s?.register_no, s?.profiles?.full_name, b.invoice_no, b.title, Number(b.amount), Number(b.concession_total), Number(b.paid_total), Number(b.outstanding), b.due_date, b.status];
      });
      return { name: "outstanding-fees", headers: ["Register no", "Student", "Invoice", "Fee", "Amount", "Concession", "Paid", "Outstanding", "Due", "Status"], rows };
    },
  },
  files: {
    permission: ["files.manage", "files.view_all", "office.reports"],
    run: async ({ sp, db }) => {
      const { from, to } = range(sp);
      const { data } = await db.from("office_files").select("reference_no, subject, category, status, priority, due_date, created_at, completed_at, assignee:profiles!office_files_assigned_to_fkey(full_name), office_sections(name)")
        .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59.999`).order("created_at");
      const rows = (data ?? []).map((f) => [f.reference_no, f.subject, f.category, f.status, f.priority, (f.office_sections as unknown as { name: string } | null)?.name ?? "", (f.assignee as unknown as { full_name: string } | null)?.full_name ?? "", f.due_date, f.created_at, f.completed_at]);
      return { name: `office-files_${from}_${to}`, headers: ["Reference", "Subject", "Category", "Status", "Priority", "Section", "Assigned to", "Due", "Created", "Completed"], rows };
    },
  },
  tasks: {
    run: async ({ sp, db }) => {
      const { from, to } = range(sp);
      const { data } = await db.from("office_tasks").select("title, status, priority, due_on, created_at, completed_at, assignee:profiles!office_tasks_assigned_to_fkey(full_name)")
        .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59.999`).order("created_at");
      const rows = (data ?? []).map((t) => [t.title, t.status, t.priority, (t.assignee as unknown as { full_name: string } | null)?.full_name ?? "", t.due_on, t.created_at, t.completed_at]);
      return { name: `tasks_${from}_${to}`, headers: ["Task", "Status", "Priority", "Assigned to", "Due", "Created", "Completed"], rows };
    },
  },
  letters: {
    permission: "letters.view",
    run: async ({ sp, db }) => {
      const { from, to } = range(sp);
      const { data } = await db.from("letters").select("reference_no, direction, letter_date, subject, sender_name, recipient_name, mode, status, received_on, dispatched_on, tracking_no")
        .gte("letter_date", from).lte("letter_date", to).order("letter_date");
      const rows = (data ?? []).map((l) => [l.reference_no, l.direction, l.letter_date, l.subject, l.sender_name, l.recipient_name, l.mode, l.status, l.received_on, l.dispatched_on, l.tracking_no]);
      return { name: `correspondence_${from}_${to}`, headers: ["Reference", "Direction", "Letter date", "Subject", "Sender", "Recipient", "Mode", "Status", "Received", "Dispatched", "Tracking"], rows };
    },
  },
  tickets: {
    permission: ["helpdesk.handle", "office.reports"],
    run: async ({ sp, db }) => {
      const { from, to } = range(sp);
      const { data } = await db.from("tickets").select("ticket_no, category, subject, status, priority, created_at, first_response_at, resolved_at, assignee:profiles!tickets_assigned_to_fkey(full_name)")
        .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59.999`).order("created_at");
      const rows = (data ?? []).map((t) => [t.ticket_no, t.category, t.subject, t.status, t.priority, (t.assignee as unknown as { full_name: string } | null)?.full_name ?? "", t.created_at, t.first_response_at, t.resolved_at]);
      return { name: `helpdesk_${from}_${to}`, headers: ["Ticket", "Category", "Subject", "Status", "Priority", "Assigned to", "Created", "First response", "Resolved"], rows };
    },
  },
  users: {
    permission: "users.manage",
    run: async ({ db }) => {
      const { data } = await db.from("profiles").select("full_name, email, phone, is_active, created_at, user_roles!user_roles_user_id_fkey(role)").order("full_name");
      const rows = (data ?? []).map((p) => [p.full_name, p.email, p.phone, (p.user_roles as { role: string }[]).map((r) => r.role).join(" "), p.is_active ? "active" : "inactive", p.created_at]);
      return { name: "users", headers: ["Name", "Email", "Phone", "Roles", "Status", "Created"], rows };
    },
  },
  students: {
    permission: ["users.manage", "students.lookup"],
    run: async ({ db }) => {
      const { data } = await db.from("students").select("register_no, admission_no, current_semester, status, profiles(full_name, email), programmes(code), batches(name)").order("register_no");
      const rows = (data ?? []).map((s) => {
        const p = s.profiles as unknown as { full_name: string; email: string };
        return [s.register_no, s.admission_no, p.full_name, p.email, (s.programmes as unknown as { code: string } | null)?.code ?? "", (s.batches as unknown as { name: string } | null)?.name ?? "", s.current_semester, s.status];
      });
      return { name: "students", headers: ["Register no", "Admission no", "Name", "Email", "Programme", "Batch", "Semester", "Status"], rows };
    },
  },
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const def = REPORTS[report];
  if (!def) return new NextResponse("Unknown report", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });
  if (def.permission && !can(user, def.permission)) return new NextResponse("Forbidden", { status: 403 });
  const out = await def.run({ sp: request.nextUrl.searchParams, db: await createClient() });
  return csvResponse(`${out.name}.csv`, toCsv(out.headers, out.rows));
}
