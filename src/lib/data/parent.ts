import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";

export type LinkedStudent = {
  link_id: string; relationship: string; student_id: string; register_no: string; current_semester: number; status: string;
  full_name: string; programme: string; department: string; batch: string | null;
};

/** Students linked to this parent with an ACTIVE, verified, consented link. */
export const getLinkedStudents = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("parent_links")
    .select("id, relationship, status, students(id, register_no, current_semester, status, profiles(full_name), programmes(name, departments(name)), batches(name))")
    .eq("parent_id", user.id);
  const active = (data ?? []).filter((l) => l.status === "active");
  const pending = (data ?? []).filter((l) => l.status === "pending").length;
  const students: LinkedStudent[] = active.map((l) => {
    const s = l.students as unknown as { id: string; register_no: string; current_semester: number; status: string; profiles: { full_name: string }; programmes: { name: string; departments: { name: string } }; batches: { name: string } | null };
    return {
      link_id: l.id, relationship: l.relationship, student_id: s.id, register_no: s.register_no, current_semester: s.current_semester, status: s.status,
      full_name: s.profiles?.full_name ?? "", programme: s.programmes?.name ?? "", department: s.programmes?.departments?.name ?? "", batch: s.batches?.name ?? null,
    };
  });
  return { user, students, pending };
});

export async function pickStudent(studentParam?: string) {
  const ctx = await getLinkedStudents();
  const current = ctx.students.find((s) => s.student_id === studentParam) ?? ctx.students[0] ?? null;
  return { ...ctx, current };
}
