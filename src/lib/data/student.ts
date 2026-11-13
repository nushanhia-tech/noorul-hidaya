import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export type StudentRecord = {
  id: string; register_no: string; admission_no: string | null; current_semester: number; status: string;
  date_of_birth: string | null; gender: string | null; address: string | null; guardian_name: string | null;
  guardian_phone: string | null; emergency_contact: string | null; admitted_on: string | null;
  programmes: { id: string; name: string; code: string; level: string; departments: { name: string } | null } | null;
  batches: { name: string; start_year: number } | null;
};

/** The signed-in student's own record (RLS restricts to profile_id = auth.uid()). */
export const getMyStudent = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id, register_no, admission_no, current_semester, status, date_of_birth, gender, address, guardian_name, guardian_phone, emergency_contact, admitted_on, programmes(id, name, code, level, departments(name)), batches(name, start_year)")
    .eq("profile_id", user.id).maybeSingle();
  if (!data) redirect("/forbidden");
  return { user, student: data as unknown as StudentRecord };
});

export type OfferingInfo = {
  id: string; semester_number: number;
  courses: { code: string; title: string; credits: number } | null;
  terms: { name: string; is_current: boolean } | null;
  offering_faculty: { faculty: { profiles: { full_name: string } | null } | null }[];
};

export async function getEnrolledOfferings(studentId: string, currentOnly = true) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrolments")
    .select("course_offerings(id, semester_number, courses(code, title, credits), terms(name, is_current), offering_faculty(faculty(profiles(full_name))))")
    .eq("student_id", studentId);
  const offerings = (data ?? []).map((r) => r.course_offerings as unknown as OfferingInfo).filter(Boolean);
  return currentOnly ? offerings.filter((o) => o.terms?.is_current) : offerings;
}

export function facultyNames(o: OfferingInfo) {
  return o.offering_faculty.map((f) => f.faculty?.profiles?.full_name).filter(Boolean).join(", ");
}

export type Slot = { id: string; day_of_week: number; starts_at: string; ends_at: string; room: string; offering_id: string };
export async function getSlotsFor(offeringIds: string[]) {
  if (!offeringIds.length) return [] as Slot[];
  const supabase = await createClient();
  const { data } = await supabase.from("timetable_slots").select("id, day_of_week, starts_at, ends_at, room, offering_id")
    .in("offering_id", offeringIds).order("day_of_week").order("starts_at");
  return (data ?? []) as Slot[];
}
