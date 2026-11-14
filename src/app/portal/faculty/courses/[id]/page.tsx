import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty, getMyOfferings, offeringLabel } from "@/lib/data/faculty";
import { PageHeader, EmptyState, KeyValue } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTime, humanize } from "@/lib/format";

export const metadata = { title: "Subject" };

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { faculty } = await getMyFaculty();
  const o = (await getMyOfferings(faculty.id, false)).find((x) => x.id === id);
  if (!o) notFound();
  const supabase = await createClient();
  const [{ data: enrol }, { data: resources }, { data: sessions }, { data: sheets }] = await Promise.all([
    supabase.from("enrolments").select("students(id, register_no, current_semester, status, profiles(full_name, email))").eq("offering_id", id),
    supabase.from("study_resources").select("id, title, resource_kind, created_at, is_published").eq("offering_id", id).order("created_at", { ascending: false }),
    supabase.from("exam_sessions").select("id, sits_on, starts_at, venue, exams(id, name, status)").eq("offering_id", id).order("sits_on"),
    supabase.from("mark_sheets").select("exam_id, status").eq("offering_id", id),
  ]);
  const students = (enrol ?? []).map((e) => e.students as unknown as { id: string; register_no: string; current_semester: number; status: string; profiles: { full_name: string; email: string } })
    .sort((a, b) => a.register_no.localeCompare(b.register_no));
  const sheetStatus = new Map((sheets ?? []).map((s) => [s.exam_id, s.status]));
  return (
    <>
      <PageHeader eyebrow={o.terms?.name} title={offeringLabel(o)} back={{ href: "/portal/faculty/courses", label: "My subjects" }}
        actions={<a href={`/api/export/class-list?offering=${o.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> Class list CSV</a>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={`Students (${students.length})`} />
          <DataTable rows={students} rowKey={(s) => s.id} empty={<EmptyState title="No students enrolled" />}
            columns={[
              { key: "reg", header: "Register no.", cell: (s) => <span className="tabular">{s.register_no}</span> },
              { key: "name", header: "Name", primary: true, cell: (s) => s.profiles?.full_name },
              { key: "email", header: "Email", cell: (s) => s.profiles?.email, mobileHidden: true },
              { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
            ]} />
        </Card>
        <div className="space-y-6">
          <Card><CardBody><KeyValue columns={1} items={[
            { label: "Division", value: o.batches?.name }, { label: "Class", value: o.batches?.programmes?.name },
            { label: "Term", value: o.semester_number }, { label: "Credits", value: Number(o.courses?.credits) },
          ]} /></CardBody></Card>
          <Card>
            <CardHeader title="Examinations" />
            {(sessions ?? []).length === 0 ? <EmptyState title="No examinations scheduled" /> : (
              <ul className="divide-y divide-line">
                {(sessions ?? []).map((s) => {
                  const ex = s.exams as unknown as { id: string; name: string; status: string };
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0"><span className="block text-sm font-medium">{ex.name}</span><span className="text-xs text-muted">{formatDate(s.sits_on)} · {formatTime(s.starts_at)} {s.venue && `· ${s.venue}`}</span></span>
                      {ex.status === "marks_entry" ? (
                        <Link href={`/portal/faculty/marks/${ex.id}/${o.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-royal hover:underline"><PenLine className="h-3.5 w-3.5" />{humanize(sheetStatus.get(ex.id) ?? "enter marks")}</Link>
                      ) : <StatusBadge status={ex.status} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Subject resources" action={<Link href={`/portal/faculty/resources?offering=${o.id}`} className="text-[13px] font-medium text-royal hover:underline">Manage</Link>} />
            {(resources ?? []).length === 0 ? <EmptyState title="No resources shared" /> : (
              <ul className="divide-y divide-line">{(resources ?? []).map((r) => <li key={r.id} className="px-5 py-3 text-sm"><a href={`/api/resources/${r.id}`} className="font-medium hover:underline">{r.title}</a><span className="block text-xs text-muted">{humanize(r.resource_kind)} · {formatDate(r.created_at)}{!r.is_published && " · hidden"}</span></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
