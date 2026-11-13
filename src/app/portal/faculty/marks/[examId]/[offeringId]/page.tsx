import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty, getMyOfferings, offeringLabel } from "@/lib/data/faculty";
import { PageHeader, Notice } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { MarksGrid } from "./grid";

export const metadata = { title: "Enter marks" };

export default async function MarksSheetPage({ params }: { params: Promise<{ examId: string; offeringId: string }> }) {
  const { examId, offeringId } = await params;
  const { faculty } = await getMyFaculty();
  const offering = (await getMyOfferings(faculty.id, false)).find((o) => o.id === offeringId);
  if (!offering) notFound();
  const supabase = await createClient();
  const [{ data: exam }, { data: enrol }, { data: sheet }] = await Promise.all([
    supabase.from("exams").select("id, name, status, max_marks, pass_percent").eq("id", examId).maybeSingle(),
    supabase.from("enrolments").select("students(id, register_no, profiles(full_name))").eq("offering_id", offeringId),
    supabase.from("mark_sheets").select("id, status, submitted_at, return_note").eq("exam_id", examId).eq("offering_id", offeringId).maybeSingle(),
  ]);
  if (!exam) notFound();
  const { data: marks } = sheet ? await supabase.from("marks").select("student_id, marks, is_absent").eq("mark_sheet_id", sheet.id) : { data: [] };
  const markMap = new Map((marks ?? []).map((m) => [m.student_id, m.is_absent ? "AB" : m.marks === null ? "" : String(Number(m.marks))]));
  const students = (enrol ?? []).map((e) => e.students as unknown as { id: string; register_no: string; profiles: { full_name: string } })
    .sort((a, b) => a.register_no.localeCompare(b.register_no))
    .map((s) => ({ id: s.id, registerNo: s.register_no, name: s.profiles?.full_name ?? "", value: markMap.get(s.id) ?? "" }));
  const editable = exam.status === "marks_entry" && sheet?.status !== "submitted";
  return (
    <>
      <PageHeader eyebrow={exam.name} title={offeringLabel(offering)} back={{ href: "/portal/faculty/marks", label: "Marks entry" }}
        description={`${offering.batches?.name} · Maximum ${Number(exam.max_marks)} · Pass ${Number(exam.pass_percent)}%`}
        actions={<StatusBadge status={sheet?.status ?? "draft"} label={sheet ? undefined : "Not started"} />} />
      {sheet?.status === "returned" && <Notice tone="warning" className="mb-5" title="Returned for correction">{sheet.return_note || "Please review and resubmit."}</Notice>}
      {sheet?.status === "submitted" && <Notice tone="info" className="mb-5">Submitted {formatDateTime(sheet.submitted_at)}. The sheet is locked; the examination cell can return it if a correction is needed.</Notice>}
      {exam.status !== "marks_entry" && <Notice tone="info" className="mb-5">Marks entry for this examination is closed.</Notice>}
      <MarksGrid examId={examId} offeringId={offeringId} max={Number(exam.max_marks)} students={students} editable={editable} />
    </>
  );
}
