import Link from "next/link";
import { Building2, CheckCircle2, CircleAlert, GraduationCap, School, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard, EmptyState, KeyValue } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { providerStatus } from "@/lib/payments/provider";
import { isEmailConfigured } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { formatDate, relativeTime, humanize, nowMs } from "@/lib/format";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboard() {
  const user = await requirePortal("admin");
  const db = await createClient();
  const t0 = nowMs();
  const count = (table: string, col?: string, val?: string | boolean) => {
    const q = db.from(table).select("*", { count: "exact", head: true });
    return col ? q.eq(col, val as string) : q;
  };
  const [students, faculty, departments, active, inactive, term, recentUsers, notices, news, events, gallery, files, tickets, sheets] = await Promise.all([
    count("students", "status", "active"),
    count("faculty"), count("departments"),
    count("profiles", "is_active", true),
    count("profiles", "is_active", false),
    db.from("terms").select("name, starts_on, ends_on, academic_years(label)").eq("is_current", true).maybeSingle(),
    db.from("profiles").select("id, full_name, created_at, user_roles(role)").order("created_at", { ascending: false }).limit(6),
    db.from("notices").select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(5),
    count("news", "status", "published"),
    count("events", "status", "published"),
    count("gallery_items"),
    Promise.resolve(null),
    db.from("tickets").select("*", { count: "exact", head: true }).not("status", "in", "(resolved,closed)"),
    db.from("mark_sheets").select("*", { count: "exact", head: true }).eq("status", "submitted"),
  ]);
  void files;
  const latency = nowMs() - t0;
  const pay = providerStatus();
  const env = serverEnv();
  const health = [
    { label: "Database", ok: !students.error, detail: students.error ? "Unreachable" : `Responding (${latency} ms for dashboard queries)` },
    { label: "Server key (storage, invitations)", ok: Boolean(env.serviceRoleKey), detail: env.serviceRoleKey ? "Configured" : "SUPABASE_SERVICE_ROLE_KEY missing" },
    { label: "Online payments", ok: pay.configured, detail: pay.configured ? (pay.mode === "sandbox" ? "Sandbox (test) mode" : "Razorpay live") : "Not configured" },
    { label: "Email notifications", ok: isEmailConfigured(), detail: isEmailConfigured() ? "Configured" : "In-app only (RESEND_API_KEY not set)" },
    { label: "Daily reminders job", ok: Boolean(env.cronSecret), detail: env.cronSecret ? "CRON_SECRET set" : "CRON_SECRET missing" },
  ];
  const tm = term.data as unknown as { name: string; starts_on: string; ends_on: string; academic_years: { label: string } } | null;
  return (
    <>
      <div className="mb-8">
        <p className="text-sm text-muted">Administration</p>
        <h1 className="font-display text-[28px] font-semibold tracking-tight sm:text-[32px]">Welcome, {user.fullName.split(" ")[0]}</h1>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active students" value={students.count ?? 0} icon={GraduationCap} tone="teal" href="/portal/admin/users?role=student" />
        <StatCard label="Faculty" value={faculty.count ?? 0} icon={School} tone="royal" href="/portal/admin/users?role=faculty" />
        <StatCard label="Departments" value={departments.count ?? 0} icon={Building2} href="/portal/admin/departments" />
        <StatCard label="Active users" value={active.count ?? 0} hint={`${inactive.count ?? 0} deactivated`} icon={Users} tone="accent" href="/portal/admin/users" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Academic configuration" action={<Link href="/portal/admin/academic" className="text-[13px] font-medium text-royal hover:underline">Manage</Link>} />
            <CardBody>
              {tm ? <KeyValue columns={3} items={[{ label: "Academic year", value: tm.academic_years?.label }, { label: "Current term", value: tm.name }, { label: "Term dates", value: `${formatDate(tm.starts_on)} – ${formatDate(tm.ends_on)}` }]} />
                : <p className="text-sm text-muted">No current term is set. Set one in Academic setup.</p>}
              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                <Badge tone={sheets.count ? "accent" : "neutral"}>{sheets.count ?? 0} mark sheets awaiting publication</Badge>
                <Badge tone={tickets.count ? "royal" : "neutral"}>{tickets.count ?? 0} open help desk tickets</Badge>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recently added users" action={<Link href="/portal/admin/users" className="text-[13px] font-medium text-royal hover:underline">All users</Link>} />
            {(recentUsers.data ?? []).length === 0 ? <EmptyState title="No users yet" /> : (
              <ul className="divide-y divide-line">
                {(recentUsers.data ?? []).map((u) => (
                  <li key={u.id}><Link href={`/portal/admin/users/${u.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white">
                    <span className="text-sm font-medium">{u.full_name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">{(u.user_roles as { role: string }[]).map((r) => <Badge key={r.role}>{humanize(r.role)}</Badge>)}{relativeTime(u.created_at)}</span>
                  </Link></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="System health" />
            <ul className="divide-y divide-line">
              {health.map((h) => (
                <li key={h.label} className="flex items-start gap-3 px-5 py-3">
                  {h.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
                  <span><span className="block text-sm font-medium">{h.label}</span><span className="text-xs text-muted">{h.detail}</span></span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Website content" action={<Link href="/portal/admin/website" className="text-[13px] font-medium text-royal hover:underline">Edit website</Link>} />
            <CardBody><KeyValue columns={3} items={[{ label: "News", value: news.count ?? 0 }, { label: "Events", value: events.count ?? 0 }, { label: "Photos", value: gallery.count ?? 0 }]} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent notices" action={<Link href="/portal/admin/notices" className="text-[13px] font-medium text-royal hover:underline">Manage</Link>} />
            {(notices.data ?? []).length === 0 ? <EmptyState title="No notices" /> : (
              <ul className="divide-y divide-line">{(notices.data ?? []).map((n) => <li key={n.id} className="flex items-center justify-between gap-3 px-5 py-3"><span className="truncate text-sm">{n.title}</span><Badge tone={n.status === "published" ? "success" : "neutral"}>{n.status}</Badge></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
