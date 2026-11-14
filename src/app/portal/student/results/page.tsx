import { Award, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent } from "@/lib/data/student";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResultsTable, type ResultRow, groupResults } from "@/components/portal/results";
import { sgpa } from "@/lib/grades";

export const metadata = { title: "Examination Results" };

export default async function StudentResults() {
  const { student } = await getMyStudent();
  const supabase = await createClient();
  const { data } = await supabase.from("results")
    .select("id, exam_id, course_code, course_title, credits, marks, max_marks, percentage, grade, grade_point, passed, is_absent, semester_number, published_at, exams(name, exam_type, terms(name))")
    .eq("student_id", student.id).order("published_at", { ascending: false });
  const rows = (data ?? []) as unknown as ResultRow[];
  const groups = groupResults(rows);
  const semesterExams = rows.filter((r) => r.exams?.exam_type === "semester");
  const overall = sgpa(semesterExams.map((r) => ({ credits: Number(r.credits), grade_point: Number(r.grade_point) })));
  return (
    <>
      <PageHeader title="Examination results" description="Only officially published results appear here." />
      {rows.length === 0 ? <Card><EmptyState icon={Award} title="No published results yet" description="You will be notified as soon as results are published." /></Card> : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Published examinations" value={groups.length} />
            <StatCard label="Papers passed" value={`${rows.filter((r) => r.passed).length}/${rows.length}`} />
            <StatCard label="CGPA (term exams)" value={overall ?? "—"} hint="Credit-weighted, 10-point scale" />
          </div>
          <div className="space-y-6">
            {groups.map((g) => (
              <Card key={g.examId}>
                <CardHeader
                  title={g.name}
                  description={`${g.term} · Term ${g.semester}`}
                  action={
                    <div className="flex items-center gap-2">
                      {g.sgpa !== null && <Badge tone="teal">SGPA {g.sgpa}</Badge>}
                      <a href={`/api/reports/results?exam=${g.examId}`} className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-white px-2.5 text-[13px] hover:bg-ivory"><Download className="h-3.5 w-3.5" /> PDF</a>
                    </div>
                  }
                />
                <ResultsTable rows={g.rows} />
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
