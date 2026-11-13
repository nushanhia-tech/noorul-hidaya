import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { lookups } from "@/lib/data/lookups";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/format";
import { ExamForm } from "../academic-forms";

export const metadata = { title: "Examinations" };

export default async function ExamsPage() {
  const me = await requirePortal("admin");
  const lk = await lookups();
  const db = await createClient();
  const { data } = await db.from("exams").select("id, name, exam_type, status, starts_on, max_marks, terms(name), mark_sheets(status)").order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as { id: string; name: string; exam_type: string; status: string; starts_on: string | null; max_marks: number; terms: { name: string }; mark_sheets: { status: string }[] }[];
  return (
    <>
      <PageHeader title="Examinations" description="Schedule examinations, open marks entry, review mark sheets and publish official results." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <DataTable rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/portal/admin/exams/${r.id}`} empty={<EmptyState title="No examinations yet" />}
            columns={[
              { key: "n", header: "Examination", primary: true, cell: (r) => r.name },
              { key: "t", header: "Term", cell: (r) => r.terms.name },
              { key: "ty", header: "Type", cell: (r) => humanize(r.exam_type) },
              { key: "d", header: "Starts", cell: (r) => formatDate(r.starts_on), mobileHidden: true },
              { key: "m", header: "Sheets submitted", align: "right", cell: (r) => `${r.mark_sheets.filter((m) => m.status === "submitted").length}/${r.mark_sheets.length}` },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} label={r.status === "marks_entry" ? "Marks entry" : undefined} /> },
            ]} />
        </Card>
        {can(me, "academics.manage") && <Card className="h-fit"><CardHeader title="New examination" /><CardBody><ExamForm terms={lk.terms} /></CardBody></Card>}
      </div>
    </>
  );
}
