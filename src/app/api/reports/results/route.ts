import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PdfBuilder, pdfResponse } from "@/lib/pdf/document";
import { getLetterhead } from "@/lib/pdf/letterhead";
import { sgpa } from "@/lib/grades";
import { formatDate } from "@/lib/format";

/** Statement of published results for one exam. ?student= lets a linked parent/staff choose; RLS enforces access. */
export async function GET(request: NextRequest) {
  const exam = request.nextUrl.searchParams.get("exam");
  const studentParam = request.nextUrl.searchParams.get("student");
  if (!exam) return new NextResponse("exam is required", { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorised", { status: 401 });
  let studentId = studentParam;
  if (!studentId) studentId = (await supabase.from("students").select("id").eq("profile_id", auth.user.id).maybeSingle()).data?.id ?? null;
  if (!studentId) return new NextResponse("Not found", { status: 404 });
  const [{ data: rows }, { data: st }, { data: ex }] = await Promise.all([
    supabase.from("results").select("course_code, course_title, credits, marks, max_marks, grade, grade_point, passed, is_absent, published_at").eq("exam_id", exam).eq("student_id", studentId).order("course_code"),
    supabase.from("students").select("register_no, current_semester, profiles(full_name), programmes(name)").eq("id", studentId).maybeSingle(),
    supabase.from("exams").select("name, published_at, terms(name)").eq("id", exam).maybeSingle(),
  ]);
  if (!rows?.length || !st || !ex) return new NextResponse("Not found", { status: 404 });
  const s = st as unknown as { register_no: string; profiles: { full_name: string }; programmes: { name: string } | null };
  const e = ex as unknown as { name: string; published_at: string; terms: { name: string } };
  const pdf = await PdfBuilder.create(await getLetterhead());
  pdf.title("Statement of results", `${e.name}  |  ${e.terms?.name ?? ""}  |  Published ${formatDate(e.published_at)}`);
  pdf.keyValues([["Student", s.profiles.full_name], ["Register number", s.register_no], ["Class", s.programmes?.name ?? "-"], ["Statement date", formatDate(new Date())]]);
  pdf.table(["Code", "Subject", "Credits", "Marks", "Grade", "Result"],
    rows.map((r) => [r.course_code, r.course_title, Number(r.credits), r.is_absent ? "AB" : `${Number(r.marks)}/${Number(r.max_marks)}`, r.grade, r.passed ? "Pass" : "Fail"]),
    [1, 3.4, 0.8, 1, 0.8, 0.8], ["left", "left", "right", "right", "right", "left"]);
  const g = sgpa(rows.map((r) => ({ credits: Number(r.credits), grade_point: Number(r.grade_point) })));
  pdf.text(`SGPA: ${g ?? "-"}   |   Papers passed: ${rows.filter((r) => r.passed).length} of ${rows.length}`, { size: 11, font: pdf.bold });
  pdf.space(20);
  pdf.text("This statement reproduces officially published results. The school office issues signed mark lists on request.", { size: 8.5 });
  pdf.footer(`Results - ${s.register_no}`);
  return pdfResponse(await pdf.bytes(), `results-${s.register_no}.pdf`);
}
