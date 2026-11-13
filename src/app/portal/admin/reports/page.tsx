import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { SimpleBarChart } from "@/components/charts";
import { ROLES, ROLE_LABELS } from "@/lib/auth/roles";

export const metadata = { title: "Reports" };

export default async function AdminReports() {
  await requirePortal("admin");
  const db = await createClient();
  const [{ data: roles }, { data: depts }, { data: results }, { data: students }, files, tickets, tasks] = await Promise.all([
    db.from("user_roles").select("role"),
    db.from("departments").select("id, name, code, programmes(id, students(count)), faculty(count), courses(count)").order("name"),
    db.from("results").select("exam_id, passed, percentage, exams(name, published_at)"),
    db.from("students").select("status"),
    db.from("office_files").select("*", { count: "exact", head: true }).not("status", "in", "(completed,archived)"),
    db.from("tickets").select("*", { count: "exact", head: true }).not("status", "in", "(resolved,closed)"),
    db.from("office_tasks").select("*", { count: "exact", head: true }).in("status", ["todo", "in_progress", "waiting"]),
  ]);
  const roleCounts = ROLES.map((r) => ({ role: ROLE_LABELS[r], users: (roles ?? []).filter((x) => x.role === r).length }));
  const deptRows = ((depts ?? []) as unknown as { id: string; name: string; code: string; programmes: { students: { count: number }[] }[]; faculty: { count: number }[]; courses: { count: number }[] }[])
    .map((d) => ({ id: d.id, name: d.name, code: d.code, programmes: d.programmes.length, students: d.programmes.reduce((n, p) => n + (p.students[0]?.count ?? 0), 0), faculty: d.faculty[0]?.count ?? 0, courses: d.courses[0]?.count ?? 0 }));
  const exMap = new Map<string, { name: string; n: number; pass: number; sum: number }>();
  for (const r of (results ?? []) as unknown as { exam_id: string; passed: boolean; percentage: number | null; exams: { name: string } }[]) {
    const e = exMap.get(r.exam_id) ?? { name: r.exams.name, n: 0, pass: 0, sum: 0 };
    e.n++; if (r.passed) e.pass++; e.sum += Number(r.percentage ?? 0);
    exMap.set(r.exam_id, e);
  }
  const examRows = [...exMap.entries()].map(([id, e]) => ({ id, name: e.name, n: e.n, pass: Math.round((e.pass / e.n) * 100), avg: Math.round((e.sum / e.n) * 10) / 10 }));
  const statusCounts = ["active", "graduated", "withdrawn", "suspended"].map((s) => ({ s, n: (students ?? []).filter((x) => x.status === s).length }));
  const exp = (href: string, label: string) => <a href={href} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" />{label}</a>;
  return (
    <>
      <PageHeader title="Reports" description="Institution-wide summaries calculated from live records." actions={<>{exp("/api/export/users", "Users CSV")}{exp("/api/export/students", "Students CSV")}</>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statusCounts.map((s) => <StatCard key={s.s} label={`Students — ${s.s}`} value={s.n} />)}
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Users by role" /><CardBody><SimpleBarChart data={roleCounts} x="role" y="users" name="Users" height={260} /></CardBody></Card>
        <Card>
          <CardHeader title="Office summary" description="Open items across the office portal" />
          <CardBody className="grid grid-cols-3 gap-3">
            <StatCard label="Open files" value={files.count ?? 0} />
            <StatCard label="Open tickets" value={tickets.count ?? 0} />
            <StatCard label="Active tasks" value={tasks.count ?? 0} />
          </CardBody>
        </Card>
      </div>
      <Card className="mb-6">
        <CardHeader title="Department summary" />
        <DataTable rows={deptRows} rowKey={(r) => r.id} empty={<EmptyState title="No departments" />} columns={[
          { key: "n", header: "Department", primary: true, cell: (r) => r.name },
          { key: "p", header: "Programmes", align: "right", cell: (r) => r.programmes },
          { key: "c", header: "Courses", align: "right", cell: (r) => r.courses },
          { key: "f", header: "Faculty", align: "right", cell: (r) => r.faculty },
          { key: "s", header: "Students", align: "right", cell: (r) => r.students },
        ]} />
      </Card>
      <Card>
        <CardHeader title="Academic summary — published examinations" />
        <DataTable rows={examRows} rowKey={(r) => r.id} empty={<EmptyState title="No published results yet" />} columns={[
          { key: "n", header: "Examination", primary: true, cell: (r) => r.name },
          { key: "c", header: "Result rows", align: "right", cell: (r) => r.n },
          { key: "a", header: "Average %", align: "right", cell: (r) => r.avg },
          { key: "p", header: "Pass rate", align: "right", cell: (r) => `${r.pass}%` },
        ]} />
      </Card>
    </>
  );
}
