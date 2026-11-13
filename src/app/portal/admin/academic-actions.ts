"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { toActionError, must, type ActionResult } from "@/lib/actions";
import { slugify } from "@/lib/format";

const s = (max = 200) => z.string().trim().max(max);
const optDate = z.string().optional().or(z.literal("")).transform((v) => v || null);
const optUuid = z.string().uuid().optional().or(z.literal("")).transform((v) => v || null);
const bool = z.string().optional().transform((v) => v === "on");
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

/** Entity definitions: table, schema and the paths to refresh. */
const ENTITIES = {
  department: {
    table: "departments", paths: ["/portal/admin/departments", "/departments", "/"],
    schema: z.object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,10}$/, "2–10 letters/digits"),
      name: s(120).min(2, "Required"), summary: s(400), description: s(8000),
      established_year: z.coerce.number().int().min(1800).max(2100).optional().or(z.literal("")).transform((v) => (v === "" ? null : v)),
      sort_order: int(0, 999).default(0), is_published: bool,
    }).transform((d) => ({ ...d, slug: slugify(d.name) })),
  },
  programme: {
    table: "programmes", paths: ["/portal/admin/programmes", "/programmes"],
    schema: z.object({
      department_id: z.string().uuid("Choose a department"),
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,16}$/, "2–16 letters/digits"),
      name: s(160).min(2, "Required"), level: z.enum(["UG", "PG", "Diploma", "Certificate", "Doctoral"]),
      duration_semesters: int(1, 12), intake: z.coerce.number().int().positive().optional().or(z.literal("")).transform((v) => (v === "" ? null : v)),
      summary: s(400), description: s(8000), eligibility: s(1000), is_published: bool,
    }).transform((d) => ({ ...d, slug: slugify(d.name) })),
  },
  course: {
    table: "courses", paths: ["/portal/admin/programmes"],
    schema: z.object({
      department_id: z.string().uuid("Choose a department"), programme_id: optUuid,
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,16}$/, "3–16 letters/digits"),
      title: s(200).min(2, "Required"), credits: z.coerce.number().min(0.5).max(30),
      semester_number: z.coerce.number().int().min(1).max(12).optional().or(z.literal("")).transform((v) => (v === "" ? null : v)),
      course_type: z.enum(["core", "elective", "common", "language", "practical"]), description: s(4000), is_active: bool,
    }),
  },
  year: {
    table: "academic_years", paths: ["/portal/admin/academic"],
    schema: z.object({ label: z.string().regex(/^\d{4}-\d{2}$/, "Format 2026-27"), starts_on: z.string().min(1), ends_on: z.string().min(1), is_current: bool }),
  },
  term: {
    table: "terms", paths: ["/portal/admin/academic"],
    schema: z.object({ academic_year_id: z.string().uuid(), name: s(80).min(2), term_type: z.enum(["odd", "even"]), starts_on: z.string().min(1), ends_on: z.string().min(1), is_current: bool }),
  },
  batch: {
    table: "batches", paths: ["/portal/admin/academic"],
    schema: z.object({ programme_id: z.string().uuid("Choose a programme"), name: s(120).min(2), start_year: int(1990, 2100), current_semester: int(1, 12), is_active: bool }),
  },
  exam: {
    table: "exams", paths: ["/portal/admin/exams"],
    schema: z.object({
      term_id: z.string().uuid("Choose a term"), name: s(120).min(2), exam_type: z.enum(["internal", "model", "semester", "supplementary"]),
      max_marks: z.coerce.number().positive().max(1000), pass_percent: z.coerce.number().min(0).max(100), starts_on: optDate, ends_on: optDate,
    }),
  },
} as const;
type Kind = keyof typeof ENTITIES;

async function guardCurrent(kind: Kind, isCurrent: boolean, id?: string) {
  if (!isCurrent || (kind !== "year" && kind !== "term")) return;
  const db = await createClient();
  const table = ENTITIES[kind].table;
  let q = db.from(table).update({ is_current: false }).eq("is_current", true);
  if (id) q = q.neq("id", id);
  must(await q);
}

export async function saveEntity(kind: Kind, id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("academics.manage");
    const def = ENTITIES[kind];
    const data = def.schema.parse(Object.fromEntries(fd)) as Record<string, unknown>;
    const db = await createClient();
    await guardCurrent(kind, Boolean(data.is_current), id ?? undefined);
    if (id) must(await db.from(def.table).update(data).eq("id", id));
    else must(await db.from(def.table).insert(data));
    def.paths.forEach((p) => revalidatePath(p));
    return { ok: true, message: id ? "Saved." : "Created." };
  } catch (e) { return toActionError(e); }
}

export async function deleteEntity(kind: Kind, id: string): Promise<ActionResult> {
  try {
    await assertPermission("academics.manage");
    const def = ENTITIES[kind];
    const db = await createClient();
    must(await db.from(def.table).delete().eq("id", id));
    def.paths.forEach((p) => revalidatePath(p));
    return { ok: true, message: "Deleted." };
  } catch (e) { return toActionError(e); }
}

/** Create a course offering and enrol every active student of the batch. */
export async function createOffering(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("academics.manage");
    const d = z.object({ course_id: z.string().uuid("Choose a course"), term_id: z.string().uuid("Choose a term"), batch_id: z.string().uuid("Choose a batch"), semester_number: int(1, 12), faculty_id: optUuid })
      .parse(Object.fromEntries(fd));
    const db = await createClient();
    const { data: off, error } = await db.from("course_offerings").insert({ course_id: d.course_id, term_id: d.term_id, batch_id: d.batch_id, semester_number: d.semester_number }).select("id").single();
    if (error) throw error;
    if (d.faculty_id) must(await db.from("offering_faculty").insert({ offering_id: off.id, faculty_id: d.faculty_id }));
    const { data: studs } = await db.from("students").select("id").eq("batch_id", d.batch_id).eq("status", "active");
    if (studs?.length) must(await db.from("enrolments").insert(studs.map((st) => ({ offering_id: off.id, student_id: st.id }))));
    revalidatePath("/portal/admin/offerings");
    return { ok: true, redirectTo: `/portal/admin/offerings/${off.id}` };
  } catch (e) { return toActionError(e); }
}

export async function assignFaculty(offeringId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("academics.manage");
    const facultyId = z.string().uuid("Choose a faculty member").parse(fd.get("faculty_id"));
    const db = await createClient();
    must(await db.from("offering_faculty").upsert({ offering_id: offeringId, faculty_id: facultyId }, { onConflict: "offering_id,faculty_id" }));
    revalidatePath(`/portal/admin/offerings/${offeringId}`);
    return { ok: true, message: "Faculty assigned." };
  } catch (e) { return toActionError(e); }
}

export async function removeFaculty(offeringId: string, facultyId: string) {
  await assertPermission("academics.manage");
  const db = await createClient();
  await db.from("offering_faculty").delete().eq("offering_id", offeringId).eq("faculty_id", facultyId);
  revalidatePath(`/portal/admin/offerings/${offeringId}`);
}

export async function syncEnrolments(offeringId: string): Promise<ActionResult> {
  try {
    await assertPermission("academics.manage");
    const db = await createClient();
    const { data: off } = await db.from("course_offerings").select("batch_id").eq("id", offeringId).single();
    const { data: studs } = await db.from("students").select("id").eq("batch_id", off!.batch_id).eq("status", "active");
    if (studs?.length) must(await db.from("enrolments").upsert(studs.map((st) => ({ offering_id: offeringId, student_id: st.id })), { onConflict: "offering_id,student_id", ignoreDuplicates: true }));
    revalidatePath(`/portal/admin/offerings/${offeringId}`);
    return { ok: true, message: `${studs?.length ?? 0} active students in the batch are enrolled.` };
  } catch (e) { return toActionError(e); }
}

export async function addSlot(offeringId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("academics.manage");
    const d = z.object({ day_of_week: int(1, 7), starts_at: z.string().regex(/^\d{2}:\d{2}$/), ends_at: z.string().regex(/^\d{2}:\d{2}$/), room: s(60) })
      .refine((v) => v.ends_at > v.starts_at, { message: "End must be after start", path: ["ends_at"] }).parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("timetable_slots").insert({ ...d, offering_id: offeringId }));
    revalidatePath(`/portal/admin/offerings/${offeringId}`);
    return { ok: true, message: "Class added to the timetable." };
  } catch (e) { return toActionError(e); }
}

export async function removeSlot(offeringId: string, slotId: string) {
  await assertPermission("academics.manage");
  const db = await createClient();
  await db.from("timetable_slots").delete().eq("id", slotId);
  revalidatePath(`/portal/admin/offerings/${offeringId}`);
}

// --- Examinations -----------------------------------------------------------
export async function setExamStatus(examId: string, status: "scheduled" | "marks_entry" | "closed"): Promise<ActionResult> {
  try {
    await assertPermission(["academics.manage", "results.publish"]);
    const db = await createClient();
    must(await db.from("exams").update({ status }).eq("id", examId).neq("status", "published"));
    revalidatePath(`/portal/admin/exams/${examId}`);
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function addExamSession(examId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("academics.manage");
    const d = z.object({ offering_id: z.string().uuid("Choose a course"), sits_on: z.string().min(1, "Date required"), starts_at: z.string().min(4), ends_at: z.string().min(4), venue: s(80) })
      .refine((v) => v.ends_at > v.starts_at, { message: "End must be after start", path: ["ends_at"] }).parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("exam_sessions").upsert({ ...d, exam_id: examId }, { onConflict: "exam_id,offering_id" }));
    revalidatePath(`/portal/admin/exams/${examId}`);
    return { ok: true, message: "Session scheduled." };
  } catch (e) { return toActionError(e); }
}

export async function returnSheet(examId: string, sheetId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("results.publish");
    const note = z.string().trim().min(3, "Explain what needs correcting").max(500).parse(fd.get("note"));
    const db = await createClient();
    must(await db.rpc("return_mark_sheet", { p_sheet: sheetId, p_note: note }));
    revalidatePath(`/portal/admin/exams/${examId}`);
    return { ok: true, message: "Mark sheet returned to the teacher." };
  } catch (e) { return toActionError(e); }
}

export async function publishResults(examId: string): Promise<ActionResult> {
  try {
    await assertPermission("results.publish");
    const db = await createClient();
    const { data, error } = await db.rpc("publish_exam_results", { p_exam: examId });
    if (error) throw error;
    revalidatePath(`/portal/admin/exams/${examId}`);
    return { ok: true, message: `Results published: ${data} result rows. Students and linked parents have been notified.` };
  } catch (e) { return toActionError(e); }
}
