import { ChartColumn, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty, getMyOfferings } from "@/lib/data/faculty";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Academic Reports" };

export default async function FacultyReports() {
  const { faculty } = await getMyFaculty();
  const offerings = await getMyOfferings(faculty.id, false);
  const supabase = await createClient();
  const ids = offerings.map((o) => o.id);
  const { data } = ids.length ? await supabase.from("results").select("offering_id, exam_id, percentage, passed, is_absent, exams(name, published_at)").in("offering_id", ids) : { data: [] };
  const rows = (data ?? []) as unknown as { offering_id: string; exam_id: string; percentage: number | null; passed: boolean; is_absent: boolean; exams: { name: string; published_at: string } }[];
  const byKey = new Map<string, typeof rows>();
  for (const r of rows) byKey.set(`${r.offering_id}:${r.exam_id}`, [...(byKey.get(`${r.offering_id}:${r.exam_id}`) ?? []), r]);
  const oMap = new Map(offerings.map((o) => [o.id, o]));
  const summary = [...byKey.entries()].map(([k, list]) => {
    const [oid, eid] = k.split(":");
    const pcts = list.filter((r) => !r.is_absent).map((r) => Number(r.percentage));
    return {
      key: k, oid, eid, course: `${oMap.get(oid)?.courses?.code} · ${oMap.get(oid)?.courses?.title}`, batch: oMap.get(oid)?.batches?.name, exam: list[0].exams.name, published: list[0].exams.published_at,
      n: list.length, absent: list.filter((r) => r.is_absent).length, avg: pcts.length ? (pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1) : "—",
      high: pcts.length ? Math.max(...pcts) : "—", pass: Math.round((list.filter((r) => r.passed).length / list.length) * 100),
    };
  }).sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));
  return (
    <>
      <PageHeader title="Academic reports" description="Course-wise examination summaries from published results. Download a full result sheet as CSV." />
      <Card>
        <CardHeader title="Examination summaries" />
        <DataTable rows={summary} rowKey={(r) => r.key} empty={<EmptyState icon={ChartColumn} title="No published results yet" />}
          columns={[
            { key: "course", header: "Course", primary: true, cell: (r) => r.course },
            { key: "batch", header: "Batch", cell: (r) => r.batch },
            { key: "exam", header: "Examination", cell: (r) => <span>{r.exam}<span className="block text-xs text-faint">{formatDate(r.published)}</span></span> },
            { key: "n", header: "Students", align: "right", cell: (r) => r.n },
            { key: "avg", header: "Avg %", align: "right", cell: (r) => r.avg },
            { key: "high", header: "High %", align: "right", cell: (r) => r.high, mobileHidden: true },
            { key: "pass", header: "Pass", align: "right", cell: (r) => `${r.pass}%` },
            { key: "dl", header: "", cell: (r) => <a className="inline-flex items-center gap-1 text-[13px] font-medium text-royal hover:underline" href={`/api/export/course-results?offering=${r.oid}&exam=${r.eid}`}><Download className="h-3.5 w-3.5" /> CSV</a> },
          ]} />
      </Card>
    </>
  );
}
