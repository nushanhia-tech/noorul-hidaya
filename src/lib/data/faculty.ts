import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";

export type FacultyRecord = {
  id: string; employee_no: string; designation: string; qualification: string; specialization: string; bio: string;
  joined_on: string | null; is_hod: boolean; departments: { id: string; name: string } | null;
};

export const getMyFaculty = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("faculty")
    .select("id, employee_no, designation, qualification, specialization, bio, joined_on, is_hod, departments(id, name)")
    .eq("profile_id", user.id).maybeSingle();
  if (!data) redirect("/forbidden");
  return { user, faculty: data as unknown as FacultyRecord };
});

export type TeachingOffering = {
  id: string; semester_number: number;
  courses: { id: string; code: string; title: string; credits: number } | null;
  terms: { id: string; name: string; is_current: boolean } | null;
  batches: { name: string; programmes: { name: string } | null } | null;
  enrolments: { count: number }[];
};

export const getMyOfferings = cache(async (facultyId: string, currentOnly = true) => {
  const supabase = await createClient();
  const { data } = await supabase.from("offering_faculty")
    .select("course_offerings(id, semester_number, courses(id, code, title, credits), terms(id, name, is_current), batches(name, programmes(name)), enrolments(count))")
    .eq("faculty_id", facultyId);
  const list = (data ?? []).map((r) => r.course_offerings as unknown as TeachingOffering).filter(Boolean);
  const sorted = list.sort((a, b) => (a.courses?.code ?? "").localeCompare(b.courses?.code ?? ""));
  return currentOnly ? sorted.filter((o) => o.terms?.is_current) : sorted;
});

export function offeringLabel(o: TeachingOffering) {
  return `${o.courses?.code} · ${o.courses?.title}`;
}
