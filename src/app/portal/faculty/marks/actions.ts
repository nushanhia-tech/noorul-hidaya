"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty } from "@/lib/data/faculty";
import { validateMark } from "@/lib/grades";
import { toActionError, type ActionResult } from "@/lib/actions";

const entrySchema = z.array(z.object({ studentId: z.string().uuid(), value: z.string().max(10) })).max(500);

/**
 * Save draft marks (and optionally submit). Authorisation is enforced by RLS
 * (faculty_teaches_offering) and the validate_mark trigger (range + lock).
 */
export async function saveMarks(examId: string, offeringId: string, entriesInput: unknown, submit: boolean): Promise<ActionResult> {
  try {
    const { user } = await getMyFaculty();
    const entries = entrySchema.parse(entriesInput);
    const supabase = await createClient();
    const { data: exam } = await supabase.from("exams").select("id, max_marks, status").eq("id", examId).single();
    if (!exam || exam.status !== "marks_entry") return { ok: false, error: "Marks entry is not open for this examination." };

    let { data: sheet } = await supabase.from("mark_sheets").select("id, status").eq("exam_id", examId).eq("offering_id", offeringId).maybeSingle();
    if (!sheet) {
      const ins = await supabase.from("mark_sheets").insert({ exam_id: examId, offering_id: offeringId }).select("id, status").single();
      if (ins.error) throw ins.error;
      sheet = ins.data;
    }
    if (sheet.status === "submitted") return { ok: false, error: "This mark sheet has already been submitted." };

    const fieldErrors: Record<string, string> = {};
    const rows = entries.map((e) => {
      const v = validateMark(e.value, Number(exam.max_marks));
      if (v.error) fieldErrors[e.studentId] = v.error;
      return { mark_sheet_id: sheet!.id, student_id: e.studentId, marks: v.marks, is_absent: v.absent, entered_by: user.id };
    });
    if (Object.keys(fieldErrors).length) return { ok: false, error: "Some marks are invalid.", fieldErrors };

    if (rows.length) {
      const { error } = await supabase.from("marks").upsert(rows, { onConflict: "mark_sheet_id,student_id" });
      if (error) throw error;
    }
    if (sheet.status === "returned") await supabase.from("mark_sheets").update({ status: "draft" }).eq("id", sheet.id);
    if (submit) {
      const { error } = await supabase.rpc("submit_mark_sheet", { p_sheet: sheet.id });
      if (error) throw error;
    }
    revalidatePath(`/portal/faculty/marks/${examId}/${offeringId}`);
    revalidatePath("/portal/faculty/marks");
    return { ok: true, message: submit ? "Marks submitted for review. The sheet is now locked." : "Draft saved." };
  } catch (e) {
    return toActionError(e);
  }
}
