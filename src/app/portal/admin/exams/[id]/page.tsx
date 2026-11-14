import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { lookups } from "@/lib/data/lookups";
import { PageHeader, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { ExamForm, EditRow } from "../../academic-forms";
import { ExamControls, SessionForm, ReturnForm } from "./controls";

export const metadata = { title: "Examination" };

export default async function ExamDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePortal("admin");
  const { id } = await params;
  const db = await createClient();
  const { data: exam } = await db.from("exams").select("*, terms(name)").eq("id", id).maybeSingle();
  if (!exam) notFound();
  const [{ data: offerings }, { data: sheets }, { data: sessions }, lk] = await Promise.all([
    db.from("course_offerings").select("id, courses(code, title), batches(name), offering_faculty(faculty(profiles(full_name)))").eq("term_id", exam.term_id),
    db.from("mark_sheets").select("id, offering_id, status, submitted_at, return_note, submitter:profiles!mark_sheets_submitted_by_fkey(full_name)").eq("exam_id", id),
    db.from("exam_sessions").select("*").eq("exam_id", id).order("sits_on"),
    lookups(),
  ]);
  const offs = (offerings ?? []) as unknown as { id: string; courses: { code: string; title: string }; batches: { name: string }; offering_faculty: { faculty: { profiles: { full_name: string } } }[] }[];
  const sheetBy = new Map((sheets ?? []).map((s) => [s.offering_id, s]));
  const sessBy = new Map((sessions ?? []).map((s) => [s.offering_id, s]));
  const submitted = offs.filter((o) => sheetBy.get(o.id)?.status === "submitted").length;
  const label = (o: (typeof offs)[number]) => `${o.courses.code} · ${o.courses.title} (${o.batches.name})`;
  return (
    <>
      <PageHeader eyebrow={(exam.terms as { name: string }).name} title={exam.name} back={{ href: "/portal/admin/exams", label: "Examinations" }}
        actions={<StatusBadge status={exam.status} label={exam.status === "marks_entry" ? "Marks entry open" : undefined} />} />
      {exam.status === "published" && <Notice tone="success" className="mb-6">Results were published {formatDateTime(exam.published_at)}. Published results are an immutable snapshot.</Notice>}
      <Card className="mb-6">
        <CardBody>
          <ExamControls examId={id} status={exam.status} canPublish={can(me, "results.publish")} canManage={can(me, "academics.manage")} ready={offs.length > 0 && submitted === offs.length} progress={`${submitted} of ${offs.length} mark sheets submitted`} />
        </CardBody>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Mark sheets by subject" />
          {offs.length === 0 ? <EmptyState title="No subject offerings in this term" /> : offs.map((o) => {
            const sh = sheetBy.get(o.id);
            const se = sessBy.get(o.id);
            return (
              <EditRow key={o.id} summary={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{label(o)}</span>
                    <span className="text-xs text-muted">{o.offering_faculty.map((f) => f.faculty.profiles.full_name).join(", ") || "No teacher"}{se && ` · ${formatDate(se.sits_on)} ${formatTime(se.starts_at)}`}</span></span>
                  <StatusBadge status={sh?.status ?? "todo"} label={sh ? undefined : "Not started"} />
                </div>
              }>
                {sh?.status === "submitted" && can(me, "results.publish") && exam.status !== "published"
                  ? <ReturnForm examId={id} sheetId={sh.id} />
                  : <p className="text-sm text-muted">{sh?.status === "returned" ? `Returned: ${sh.return_note}` : sh ? `Draft in progress.` : "The teacher has not started entering marks."}</p>}
                {sh?.submitted_at && <p className="mt-2 text-xs text-faint">Submitted {formatDateTime(sh.submitted_at)} by {(sh.submitter as unknown as { full_name: string } | null)?.full_name}</p>}
              </EditRow>
            );
          })}
        </Card>
        <div className="space-y-6">
          {can(me, "academics.manage") && (
            <Card>
              <CardHeader title="Schedule a paper" description="Shown on student dashboards" />
              <CardBody><SessionForm examId={id} offerings={offs.map((o) => ({ value: o.id, label: label(o) }))} /></CardBody>
            </Card>
          )}
          {can(me, "academics.manage") && exam.status !== "published" && (
            <Card><CardHeader title="Edit examination" /><CardBody><ExamForm d={exam} id={id} terms={lk.terms} /></CardBody></Card>
          )}
        </div>
      </div>
    </>
  );
}
