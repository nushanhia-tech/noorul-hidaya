"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/auth/session";
import { ROLES, type Role } from "@/lib/auth/roles";
import { passwordSchema } from "@/lib/validation/auth";
import { logSecurityEvent } from "@/lib/security";
import { toActionError, must, type ActionResult } from "@/lib/actions";

const opt = (s: z.ZodString) => s.optional().or(z.literal("")).transform((v) => v || null);
const uuidOpt = z.string().uuid().optional().or(z.literal("")).transform((v) => v || null);

const autoNo = (prefix: string) => `${prefix}-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const optInt = (min: number, max: number, fallback: number) =>
  z.union([z.literal(""), z.coerce.number().int().min(min).max(max)]).optional().transform((v) => (v === "" || v === undefined ? fallback : v));

/** Every academic field is optional; blank ID numbers are generated automatically. */
const studentFields = z.object({
  register_no: z.string().trim().max(40).optional().transform((v) => v || autoNo("STU")),
  admission_no: opt(z.string().trim().max(40)),
  programme_id: uuidOpt,
  batch_id: uuidOpt,
  current_semester: optInt(1, 12, 1),
  date_of_birth: opt(z.string()),
  gender: z.enum(["female", "male", "other", "undisclosed"]).optional().or(z.literal("")).transform((v) => v || null),
  guardian_name: opt(z.string().trim().max(120)),
  admitted_on: opt(z.string()),
  status: z.enum(["active", "graduated", "withdrawn", "suspended"]).optional().or(z.literal("")).transform((v) => v || "active"),
});
const facultyFields = z.object({
  employee_no: z.string().trim().max(40).optional().transform((v) => v || autoNo("EMP")),
  department_id: uuidOpt,
  designation: z.string().trim().max(120).optional().transform((v) => v || "Faculty"),
  joined_on: opt(z.string()),
  is_hod: z.string().optional().transform((v) => v === "on"),
  is_public: z.string().optional().transform((v) => v === "on"),
});

/** Enrol a student in every course offering of their batch, so they appear in class lists and mark sheets. */
async function enrolInBatchOfferings(db: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: st } = await db.from("students").select("id, batch_id, status").eq("profile_id", userId).maybeSingle();
  if (!st?.batch_id || st.status !== "active") return 0;
  const { data: offs } = await db.from("course_offerings").select("id").eq("batch_id", st.batch_id);
  if (!offs?.length) return 0;
  must(await db.from("enrolments").upsert(offs.map((o) => ({ offering_id: o.id, student_id: st.id })), { onConflict: "offering_id,student_id", ignoreDuplicates: true }));
  return offs.length;
}

/** Make sure a user with the student/faculty role has a matching record, so they show everywhere. */
async function ensureRecords(db: Awaited<ReturnType<typeof createClient>>, userId: string, roles: Role[]) {
  if (roles.includes("student")) {
    const { data } = await db.from("students").select("id").eq("profile_id", userId).maybeSingle();
    if (!data) must(await db.from("students").insert({ profile_id: userId, register_no: autoNo("STU") }));
  }
  if (roles.includes("faculty")) {
    const { data } = await db.from("faculty").select("id").eq("profile_id", userId).maybeSingle();
    if (!data) must(await db.from("faculty").insert({ profile_id: userId, employee_no: autoNo("EMP"), is_public: true }));
  }
}

function rolesFrom(fd: FormData): Role[] {
  return fd.getAll("roles").map(String).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
}

export async function createUser(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  try {
    const me = await assertPermission(["users.manage"]);
    const base = z.object({
      full_name: z.string().trim().min(2, "Enter the full name").max(120),
      email: z.string().trim().toLowerCase().email("Enter a valid email"),
      phone: z.string().trim().max(20).regex(/^[0-9+() -]*$/, "Invalid phone").optional(),
    }).parse(Object.fromEntries(fd));
    const roles = rolesFrom(fd);
    if (roles.some((r) => r === "admin") && !me.permissions.has("roles.manage")) return { ok: false, error: "Only role managers can create administrators." };
    const raw = Object.fromEntries(fd);
    const student = roles.includes("student") ? studentFields.parse(raw) : null;
    const faculty = roles.includes("faculty") ? facultyFields.parse(raw) : null;

    const admin = createAdminClient();
    // No emails: the administrator sets the password and the account is confirmed immediately.
    const password = passwordSchema.parse(fd.get("password"));
    const { data, error } = await admin.auth.admin.createUser({ email: base.email, password, email_confirm: true, user_metadata: { full_name: base.full_name } });
    if (error) return { ok: false, error: error.message.includes("already") ? "A user with this email already exists." : error.message };
    createdId = data.user.id;

    const db = await createClient();
    must(await db.from("profiles").update({ full_name: base.full_name, phone: base.phone || null }).eq("id", createdId));
    if (roles.length) must(await db.from("user_roles").insert(roles.map((role) => ({ user_id: createdId, role, granted_by: me.id }))));
    if (student) must(await db.from("students").insert({ ...student, profile_id: createdId }));
    if (student) await enrolInBatchOfferings(db, createdId);
    if (faculty) must(await db.from("faculty").insert({ ...faculty, profile_id: createdId }));
    const sections = fd.getAll("sections").map(String).filter(Boolean);
    if (sections.length) must(await db.from("staff_sections").insert(sections.map((section_id) => ({ user_id: createdId, section_id }))));

    await logSecurityEvent("user_created", me.id, { target: createdId, roles });
    revalidatePath("/portal/admin/users");
    return { ok: true, redirectTo: `/portal/admin/users/${createdId}?created=1` };
  } catch (e) {
    if (createdId) await createAdminClient().auth.admin.deleteUser(createdId).catch(() => undefined);
    return toActionError(e);
  }
}

export async function updateAccount(userId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("users.manage");
    const data = z.object({
      full_name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(20).regex(/^[0-9+() -]*$/, "Invalid phone"),
      is_active: z.string().optional().transform((v) => v === "on"),
    }).parse(Object.fromEntries(fd));
    if (userId === me.id && !data.is_active) return { ok: false, error: "You cannot deactivate your own account." };
    const db = await createClient();
    const { data: before } = await db.from("profiles").select("is_active").eq("id", userId).single();
    must(await db.from("profiles").update({ full_name: data.full_name, phone: data.phone || null, is_active: data.is_active }).eq("id", userId));
    if (before && before.is_active !== data.is_active) {
      // Block / unblock sign-in at the auth layer too.
      await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: data.is_active ? "none" : "876000h" });
      await logSecurityEvent(data.is_active ? "user_reactivated" : "user_deactivated", me.id, { target: userId });
    }
    revalidatePath(`/portal/admin/users/${userId}`);
    return { ok: true, message: "Account saved." };
  } catch (e) { return toActionError(e); }
}

export async function setRoles(userId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("roles.manage");
    const wanted = new Set(rolesFrom(fd));
    const db = await createClient();
    const { data: current } = await db.from("user_roles").select("role").eq("user_id", userId);
    const have = new Set((current ?? []).map((r) => r.role as Role));
    if (userId === me.id && have.has("admin") && !wanted.has("admin")) return { ok: false, error: "You cannot remove your own administrator role." };
    const add = [...wanted].filter((r) => !have.has(r));
    const remove = [...have].filter((r) => !wanted.has(r));
    if (add.length) must(await db.from("user_roles").insert(add.map((role) => ({ user_id: userId, role, granted_by: me.id }))));
    if (remove.length) must(await db.from("user_roles").delete().eq("user_id", userId).in("role", remove));
    const sections = fd.getAll("sections").map(String).filter(Boolean);
    must(await db.from("staff_sections").delete().eq("user_id", userId));
    if (sections.length) must(await db.from("staff_sections").insert(sections.map((section_id) => ({ user_id: userId, section_id }))));
    await ensureRecords(db, userId, [...wanted]);
    if (add.length || remove.length) await logSecurityEvent("roles_changed", me.id, { target: userId, add, remove });
    revalidatePath(`/portal/admin/users/${userId}`);
    return { ok: true, message: "Roles updated." };
  } catch (e) { return toActionError(e); }
}

export async function saveStudentRecord(userId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("users.manage");
    const data = studentFields.parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("students").upsert({ ...data, profile_id: userId }, { onConflict: "profile_id" }));
    const n = await enrolInBatchOfferings(db, userId);
    revalidatePath(`/portal/admin/users/${userId}`);
    return { ok: true, message: data.batch_id ? `Student record saved. Enrolled in ${n} course(s) of the batch.` : "Student record saved. Choose a batch to enrol the student in its courses." };
  } catch (e) { return toActionError(e); }
}

export async function saveFacultyRecord(userId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("users.manage");
    const data = facultyFields.parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("faculty").upsert({ ...data, profile_id: userId }, { onConflict: "profile_id" }));
    revalidatePath(`/portal/admin/users/${userId}`);
    revalidatePath("/faculty");
    return { ok: true, message: "Faculty record saved." };
  } catch (e) { return toActionError(e); }
}

/** Link a parent account to a student after verification (and recorded consent). */
export async function linkParent(parentId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("users.manage");
    const data = z.object({
      register_no: z.string().trim().min(1, "Enter the student's register number"),
      relationship: z.enum(["mother", "father", "guardian", "other"]),
      consent: z.string().optional(),
      notes: z.string().trim().max(500).optional(),
    }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const { data: st } = await db.from("students").select("id").eq("register_no", data.register_no).maybeSingle();
    if (!st) return { ok: false, error: "No student with that register number.", fieldErrors: { register_no: "Not found" } };
    const verified = data.consent === "on";
    must(await db.from("parent_links").upsert({
      parent_id: parentId, student_id: st.id, relationship: data.relationship, notes: data.notes || null,
      consent_recorded: verified, status: verified ? "active" : "pending",
      verified_at: verified ? new Date().toISOString() : null, verified_by: verified ? me.id : null,
    }, { onConflict: "parent_id,student_id" }));
    await logSecurityEvent("parent_link_changed", me.id, { parent: parentId, student: st.id, status: verified ? "active" : "pending" });
    revalidatePath(`/portal/admin/users/${parentId}`);
    return { ok: true, message: verified ? "Link verified and active." : "Link saved as pending until consent/verification is recorded." };
  } catch (e) { return toActionError(e); }
}

export async function setLinkStatus(linkId: string, parentId: string, status: "active" | "revoked") {
  const me = await assertPermission("users.manage");
  const db = await createClient();
  const patch = status === "active" ? { status, consent_recorded: true, verified_at: new Date().toISOString(), verified_by: me.id } : { status };
  await db.from("parent_links").update(patch).eq("id", linkId);
  await logSecurityEvent("parent_link_changed", me.id, { link: linkId, status });
  revalidatePath(`/portal/admin/users/${parentId}`);
}

/** Administrator sets a new password for a user (no email involved). */
export async function setUserPassword(userId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("users.manage");
    const password = passwordSchema.parse(fd.get("password"));
    const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) return { ok: false, error: error.message };
    await logSecurityEvent("password_set_by_admin", me.id, { target: userId });
    return { ok: true, message: "Password updated. Give it to the user securely; they can change it in Account settings." };
  } catch (e) { return toActionError(e); }
}
