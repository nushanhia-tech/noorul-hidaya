import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Small option lists for admin/office forms (RLS applies). */
export async function lookups() {
  const db = await createClient();
  const [d, p, b, t, y, c, s] = await Promise.all([
    db.from("departments").select("id, name, code").order("name"),
    db.from("programmes").select("id, name, code, department_id, duration_semesters").order("name"),
    db.from("batches").select("id, name, programme_id, current_semester, is_active").order("start_year", { ascending: false }),
    db.from("terms").select("id, name, is_current, academic_year_id, starts_on").order("starts_on", { ascending: false }),
    db.from("academic_years").select("id, label, is_current").order("starts_on", { ascending: false }),
    db.from("courses").select("id, code, title, programme_id, department_id, semester_number").order("code"),
    db.from("office_sections").select("id, name, code").order("name"),
  ]);
  return {
    departments: d.data ?? [], programmes: p.data ?? [], batches: b.data ?? [], terms: t.data ?? [],
    years: y.data ?? [], courses: c.data ?? [], sections: s.data ?? [],
  };
}

export async function staffOptions(roles: string[] = ["office_clerk", "office_superintendent", "accountant", "office_supervisor"]) {
  const db = await createClient();
  const { data } = await db.from("user_roles").select("user_id, role, profiles!user_roles_user_id_fkey(full_name, is_active)").in("role", roles);
  const map = new Map<string, string>();
  for (const r of data ?? []) {
    const p = r.profiles as unknown as { full_name: string; is_active: boolean } | null;
    if (p?.is_active) map.set(r.user_id, p.full_name);
  }
  return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

export async function facultyOptions() {
  const db = await createClient();
  const { data } = await db.from("faculty").select("id, employee_no, profiles(full_name), departments(code)").order("employee_no");
  return (data ?? []).map((f) => ({ value: f.id, label: `${(f.profiles as unknown as { full_name: string }).full_name} (${(f.departments as unknown as { code: string }).code})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
