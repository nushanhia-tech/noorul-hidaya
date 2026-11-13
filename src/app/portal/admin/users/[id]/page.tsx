import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { lookups } from "@/lib/data/lookups";
import { PageHeader, Notice } from "@/components/ui/misc";
import { isRole, type Role } from "@/lib/auth/roles";
import { UserDetail } from "./detail";

export const metadata = { title: "User" };

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const me = await requirePortal("admin");
  const { id } = await params;
  const { created } = await searchParams;
  const db = await createClient();
  const [{ data: p }, { data: roles }, { data: student }, { data: faculty }, { data: links }, { data: secs }, lk] = await Promise.all([
    db.from("profiles").select("id, full_name, email, phone, is_active, created_at").eq("id", id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", id),
    db.from("students").select("*").eq("profile_id", id).maybeSingle(),
    db.from("faculty").select("*").eq("profile_id", id).maybeSingle(),
    db.from("parent_links").select("id, relationship, status, consent_recorded, verified_at, students(register_no, profiles(full_name))").eq("parent_id", id),
    db.from("staff_sections").select("section_id").eq("user_id", id),
    lookups(),
  ]);
  if (!p) notFound();
  const roleList = (roles ?? []).map((r) => r.role).filter(isRole) as Role[];
  return (
    <>
      <PageHeader title={p.full_name} description={p.email ?? undefined} back={{ href: "/portal/admin/users", label: "Users" }} />
      {created && <Notice tone="success" className="mb-6">User created. {p.is_active ? "They can now sign in (or will receive an invitation email)." : ""}</Notice>}
      <UserDetail
        profile={p} roles={roleList} student={student} faculty={faculty} lk={lk}
        sections={(secs ?? []).map((s) => s.section_id)} canRoles={can(me, "roles.manage")} isSelf={me.id === id}
        links={(links ?? []).map((l) => {
          const s = l.students as unknown as { register_no: string; profiles: { full_name: string } };
          return { id: l.id, relationship: l.relationship, status: l.status, consent: l.consent_recorded, name: s.profiles.full_name, register_no: s.register_no };
        })}
      />
    </>
  );
}
