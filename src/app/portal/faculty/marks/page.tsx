import { PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty, getMyOfferings } from "@/lib/data/faculty";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/format";

export const metadata = { title: "Marks Entry" };

export default async function MarksIndex() {
  const { faculty } = await getMyFaculty();
  const offerings = await getMyOfferings(faculty.id, false);
  const termIds = Array.from(new Set(offerings.map((o) => o.terms?.id).filter(Boolean))) as string[];
  const supabase = await createClient();
  const [{ data: exams }, { data: sheets }] = await Promise.all([
    termIds.length ? supabase.from("exams").select("id, name, status, term_id, max_marks, ends_on").in("term_id", termIds).in("status", ["marks_entry", "closed", "published"]).order("starts_on", { ascending: false }) : { data: [] },
    offerings.length ? supabase.from("mark_sheets").select("exam_id, offering_id, status, submitted_at").in("offering_id", offerings.map((o) => o.id)) : { data: [] },
  ]);
  const sheetMap = new Map((sheets ?? []).map((s) => [`${s.exam_id}:${s.offering_id}`, s]));
  const rows = (exams ?? []).flatMap((e) => offerings.filter((o) => o.terms?.id === e.term_id).map((o) => ({ exam: e, offering: o, sheet: sheetMap.get(`${e.id}:${o.id}`) })));
  const open = rows.filter((r) => r.exam.status === "marks_entry");
  const done = rows.filter((r) => r.exam.status !== "marks_entry");
  const cols = [
    { key: "course", header: "Course", primary: true, cell: (r: (typeof rows)[number]) => <span><span className="tabular mr-2 text-faint">{r.offering.courses?.code}</span>{r.offering.courses?.title}</span> },
    { key: "exam", header: "Examination", cell: (r: (typeof rows)[number]) => r.exam.name },
    { key: "batch", header: "Batch", cell: (r: (typeof rows)[number]) => r.offering.batches?.name },
    { key: "max", header: "Max", align: "right" as const, cell: (r: (typeof rows)[number]) => Number(r.exam.max_marks) },
    { key: "status", header: "Sheet", cell: (r: (typeof rows)[number]) => r.sheet ? <StatusBadge status={r.sheet.status} /> : <StatusBadge status="todo" label="Not started" /> },
    { key: "sub", header: "Submitted", cell: (r: (typeof rows)[number]) => formatDate(r.sheet?.submitted_at), mobileHidden: true },
  ];
  return (
    <>
      <PageHeader title="Marks entry" description="Enter marks only for courses assigned to you. Submitted sheets are locked and sent for result publication." />
      <Card className="mb-6">
        <CardHeader title="Open for entry" />
        <DataTable rows={open} rowKey={(r) => `${r.exam.id}:${r.offering.id}`} rowHref={(r) => `/portal/faculty/marks/${r.exam.id}/${r.offering.id}`} columns={cols}
          empty={<EmptyState icon={PenLine} title="No examinations open for marks entry" description="The examination cell opens marks entry after each examination." />} />
      </Card>
      <Card>
        <CardHeader title="Closed and published" />
        <DataTable rows={done} rowKey={(r) => `${r.exam.id}:${r.offering.id}`} rowHref={(r) => `/portal/faculty/marks/${r.exam.id}/${r.offering.id}`}
          columns={[...cols.slice(0, 4), { key: "estatus", header: "Exam", cell: (r) => humanize(r.exam.status) }]} empty={<EmptyState title="Nothing here yet" />} />
      </Card>
    </>
  );
}
