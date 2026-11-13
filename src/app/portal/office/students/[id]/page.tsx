import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, KeyValue, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/fees";
import { formatDate, humanize } from "@/lib/format";

export const metadata = { title: "Student record" };

export default async function StudentRecord({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortal("office");
  const { id } = await params;
  const db = await createClient();
  const { data: s } = await db.from("students").select("*, profiles(full_name, email, phone), programmes(name, departments(name)), batches(name)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [bal, files, tickets] = await Promise.all([
    can(user, "finance.view") ? db.from("student_fee_balances").select("*").eq("student_id", id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("office_files").select("id, reference_no, subject, status").eq("student_id", id).order("created_at", { ascending: false }).limit(10),
    can(user, "helpdesk.handle") ? db.from("tickets").select("id, ticket_no, subject, status").eq("student_id", id).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
  ]);
  const p = s.profiles as { full_name: string; email: string; phone: string | null };
  const prog = s.programmes as { name: string; departments: { name: string } };
  return (
    <>
      <PageHeader eyebrow={s.register_no} title={p.full_name} back={{ href: "/portal/office/students", label: "Student search" }}
        actions={<>
          {can(user, "files.manage") && <Link href={`/portal/office/files/new?student=${id}`} className="inline-flex h-9 items-center rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white">New file</Link>}
          {can(user, "finance.view") && <Link href={`/portal/office/accounts/ledgers/${id}`} className="inline-flex h-9 items-center rounded-sm bg-ink px-3 text-sm text-white">Fee ledger</Link>}
        </>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card><CardBody><KeyValue items={[
          { label: "Programme", value: prog.name }, { label: "Department", value: prog.departments.name },
          { label: "Batch", value: (s.batches as { name: string } | null)?.name }, { label: "Semester", value: s.current_semester },
          { label: "Status", value: <StatusBadge status={s.status} /> }, { label: "Admission no.", value: s.admission_no },
          { label: "Email", value: p.email }, { label: "Phone", value: p.phone },
          { label: "Guardian", value: s.guardian_name }, { label: "Guardian phone", value: s.guardian_phone },
          { label: "Date of birth", value: formatDate(s.date_of_birth) }, { label: "Gender", value: humanize(s.gender) },
        ]} /></CardBody></Card>
        <div className="space-y-6">
          {bal.data && <Card><CardHeader title="Fees" /><CardBody><KeyValue columns={3} items={[{ label: "Assigned", value: formatMoney(bal.data.total_assigned) }, { label: "Paid", value: formatMoney(bal.data.total_paid) }, { label: "Outstanding", value: formatMoney(bal.data.outstanding) }]} /></CardBody></Card>}
          <Card>
            <CardHeader title="Office files" />
            {(files.data ?? []).length === 0 ? <EmptyState title="No files" /> : <ul className="divide-y divide-line">{(files.data ?? []).map((f) => <li key={f.id}><Link href={`/portal/office/files/${f.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white"><span className="min-w-0 truncate text-sm">{f.subject}<span className="tabular block text-xs text-muted">{f.reference_no}</span></span><StatusBadge status={f.status} /></Link></li>)}</ul>}
          </Card>
          {(tickets.data ?? []).length > 0 && (
            <Card><CardHeader title="Help desk requests" /><ul className="divide-y divide-line">{(tickets.data ?? []).map((t) => <li key={t.id}><Link href={`/portal/office/helpdesk/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white"><span className="truncate text-sm">{t.subject}</span><StatusBadge status={t.status} /></Link></li>)}</ul></Card>
          )}
        </div>
      </div>
    </>
  );
}
