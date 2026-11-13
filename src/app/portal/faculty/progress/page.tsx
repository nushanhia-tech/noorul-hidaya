import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty, getMyOfferings, offeringLabel } from "@/lib/data/faculty";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { SimpleBarChart } from "@/components/charts";
import { DataTable } from "@/components/ui/table";
import { distribution } from "@/lib/grades";

export const metadata = { title: "Academic Progress" };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ offering?: string }> }) {
  const { offering: sel } = await searchParams;
  const { faculty } = await getMyFaculty();
  const offerings = await getMyOfferings(faculty.id, false);
  const current = offerings.find((o) => o.id === sel) ?? offerings.find((o) => o.terms?.is_current) ?? offerings[0];
  if (!current) return <><PageHeader title="Academic progress" /><Card><EmptyState icon={TrendingUp} title="No courses assigned" /></Card></>;
  const supabase = await createClient();
  const { data } = await supabase.from("results").select("student_id, exam_id, percentage, grade, passed, exams(name, published_at)").eq("offering_id", current.id);
  const rows = (data ?? []) as unknown as { student_id: string; exam_id: string; percentage: number | null; grade: string; passed: boolean; exams: { name: string; published_at: string } }[];
  const exams = [...new Map(rows.map((r) => [r.exam_id, r.exams])).entries()].sort((a, b) => (a[1].published_at ?? "").localeCompare(b[1].published_at ?? ""));
  const perExam = exams.map(([id, ex]) => {
    const list = rows.filter((r) => r.exam_id === id);
    const pcts = list.map((r) => Number(r.percentage ?? 0));
    return { id, name: ex.name, count: list.length, avg: pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : 0, pass: list.length ? Math.round((list.filter((r) => r.passed).length / list.length) * 100) : 0 };
  });
  const latest = exams.at(-1);
  const dist = latest ? distribution(rows.filter((r) => r.exam_id === latest[0]).map((r) => r.grade)) : [];
  return (
    <>
      <PageHeader title="Academic progress" description="Based only on officially published results for your courses." />
      <FilterBar className="mb-6" placeholder="Search" q={undefined}>
        <FilterSelect name="offering" value={current.id} label="Course" options={offerings.map((o) => ({ value: o.id, label: `${offeringLabel(o)} (${o.batches?.name})` }))} />
      </FilterBar>
      {rows.length === 0 ? <Card><EmptyState icon={TrendingUp} title="No published results for this course yet" /></Card> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Published examinations" value={perExam.length} />
            <StatCard label={`Average — ${latest?.[1].name}`} value={`${perExam.at(-1)?.avg ?? 0}%`} />
            <StatCard label="Pass rate (latest)" value={`${perExam.at(-1)?.pass ?? 0}%`} tone="teal" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Grade distribution" description={latest?.[1].name} />
              <CardBody><SimpleBarChart data={dist} x="grade" y="count" name="Students" /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Average score by examination" description="Percentage" />
              <CardBody><SimpleBarChart data={perExam} x="name" y="avg" name="Average %" color="#4a4ddb" /></CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="Examination summary" />
            <DataTable rows={perExam} rowKey={(r) => r.id} columns={[
              { key: "n", header: "Examination", primary: true, cell: (r) => r.name },
              { key: "c", header: "Students", align: "right", cell: (r) => r.count },
              { key: "a", header: "Average %", align: "right", cell: (r) => r.avg },
              { key: "p", header: "Pass rate", align: "right", cell: (r) => `${r.pass}%` },
            ]} />
          </Card>
        </div>
      )}
    </>
  );
}
