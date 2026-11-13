import { Award, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { pickStudent } from "@/lib/data/parent";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentSwitcher, NoLinkedStudent } from "@/components/portal/student-switcher";
import { ResultsTable, groupResults, type ResultRow } from "@/components/portal/results";

export const metadata = { title: "Academic Results" };

export default async function ParentResults({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { students, current, pending } = await pickStudent((await searchParams).student);
  if (!current) return <><PageHeader title="Academic results" /><NoLinkedStudent pending={pending} /></>;
  const supabase = await createClient();
  const { data } = await supabase.from("results")
    .select("id, exam_id, course_code, course_title, credits, marks, max_marks, percentage, grade, grade_point, passed, is_absent, semester_number, published_at, exams(name, exam_type, terms(name))")
    .eq("student_id", current.student_id).order("published_at", { ascending: false });
  const groups = groupResults((data ?? []) as unknown as ResultRow[]);
  return (
    <>
      <PageHeader title="Academic results" description={`Published results for ${current.full_name}.`} />
      <StudentSwitcher students={students} current={current} base="/portal/parent/results" />
      {groups.length === 0 ? <Card><EmptyState icon={Award} title="No published results yet" /></Card> : (
        <div className="space-y-6">
          {groups.map((g) => (
            <Card key={g.examId}>
              <CardHeader title={g.name} description={`${g.term} · Semester ${g.semester}`} action={
                <div className="flex items-center gap-2">
                  {g.sgpa !== null && <Badge tone="teal">SGPA {g.sgpa}</Badge>}
                  <a href={`/api/reports/results?exam=${g.examId}&student=${current.student_id}`} className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-white px-2.5 text-[13px]"><Download className="h-3.5 w-3.5" /> PDF</a>
                </div>
              } />
              <ResultsTable rows={g.rows} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
