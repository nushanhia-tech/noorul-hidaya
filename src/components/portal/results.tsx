import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { sgpa } from "@/lib/grades";

export type ResultRow = {
  id: string; exam_id: string; course_code: string; course_title: string; credits: number; marks: number | null; max_marks: number;
  percentage: number | null; grade: string; grade_point: number; passed: boolean; is_absent: boolean; semester_number: number; published_at: string;
  exams: { name: string; exam_type: string; terms: { name: string } | null } | null;
};

export function groupResults(rows: ResultRow[]) {
  const map = new Map<string, ResultRow[]>();
  for (const r of rows) map.set(r.exam_id, [...(map.get(r.exam_id) ?? []), r]);
  return [...map.entries()].map(([examId, list]) => ({
    examId, rows: list, name: list[0].exams?.name ?? "Examination", term: list[0].exams?.terms?.name ?? "", semester: list[0].semester_number,
    sgpa: sgpa(list.map((r) => ({ credits: Number(r.credits), grade_point: Number(r.grade_point) }))),
  }));
}

export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      columns={[
        { key: "course", header: "Subject", primary: true, cell: (r) => <span><span className="tabular mr-2 text-faint">{r.course_code}</span><span className="font-medium text-ink">{r.course_title}</span></span> },
        { key: "credits", header: "Credits", align: "right", cell: (r) => Number(r.credits) },
        { key: "marks", header: "Marks", align: "right", cell: (r) => (r.is_absent ? "AB" : `${Number(r.marks)}/${Number(r.max_marks)}`) },
        { key: "grade", header: "Grade", align: "right", cell: (r) => <Badge tone={r.passed ? "success" : "danger"}>{r.grade}</Badge> },
        { key: "result", header: "Result", align: "right", cell: (r) => (r.passed ? "Pass" : r.is_absent ? "Absent" : "Fail") },
      ]}
    />
  );
}
