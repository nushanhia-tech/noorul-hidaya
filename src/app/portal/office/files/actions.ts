"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { attachFiles, filesFrom } from "@/lib/documents";
import { UploadError } from "@/lib/storage";
import { FILE_CATEGORIES } from "@/lib/constants";
import { toActionError, must, type ActionResult } from "@/lib/actions";

const uuidOpt = z.string().uuid().optional().or(z.literal("")).transform((v) => v || null);
const note = z.string().trim().max(2000).optional().transform((v) => v || null);

async function addMovementNote(fileId: string, userId: string, text: string | null, action: "note" | "document_added" = "note") {
  if (!text) return;
  const db = await createClient();
  must(await db.from("file_movements").insert({ file_id: fileId, action, note: text, actor_id: userId }));
}

export async function createFile(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("files.manage");
    const d = z.object({
      subject: z.string().trim().min(3, "Enter a subject").max(200), description: z.string().trim().max(5000).default(""),
      category: z.enum(Object.keys(FILE_CATEGORIES) as [string, ...string[]]), priority: z.enum(["low", "normal", "high", "urgent"]),
      student_id: uuidOpt, department_id: uuidOpt, section_id: uuidOpt, assigned_to: uuidOpt,
      due_date: z.string().optional().transform((v) => v || null),
    }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const { data, error } = await db.from("office_files").insert({ ...d, created_by: me.id }).select("id").single();
    if (error) throw error;
    const files = filesFrom(fd);
    if (files.length) await attachFiles("office_file", data.id, me.id, files);
    revalidatePath("/portal/office/files");
    return { ok: true, redirectTo: `/portal/office/files/${data.id}` };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

/** Assign, forward to another section, and/or change status — each change is recorded in the movement history. */
export async function processFile(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission(["files.manage", "files.view_all"]);
    const d = z.object({
      status: z.enum(["new", "assigned", "in_progress", "waiting_info", "completed"]).optional(),
      assigned_to: uuidOpt, section_id: uuidOpt, priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      due_date: z.string().optional().transform((v) => v || null), note,
    }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const { data: cur } = await db.from("office_files").select("status").eq("id", id).single();
    if (cur?.status === "archived") return { ok: false, error: "Archived files are read-only. Restore the file first." };
    const patch: Record<string, unknown> = { assigned_to: d.assigned_to, section_id: d.section_id, due_date: d.due_date };
    if (d.priority) patch.priority = d.priority;
    if (d.status) patch.status = d.status;
    if (d.status === "new" && d.assigned_to) patch.status = "assigned";
    must(await db.from("office_files").update(patch).eq("id", id));
    await addMovementNote(id, me.id, d.note);
    revalidatePath(`/portal/office/files/${id}`);
    return { ok: true, message: "File updated." };
  } catch (e) { return toActionError(e); }
}

export async function addFileNote(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission(["files.manage", "files.view_all"]);
    const text = z.string().trim().min(1, "Write a note").max(2000).parse(fd.get("note"));
    await addMovementNote(id, me.id, text);
    revalidatePath(`/portal/office/files/${id}`);
    return { ok: true, message: "Note added." };
  } catch (e) { return toActionError(e); }
}

export async function addFileDocuments(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission(["files.manage", "files.view_all"]);
    const files = filesFrom(fd);
    if (!files.length) return { ok: false, error: "Choose at least one file." };
    const names = await attachFiles("office_file", id, me.id, files, String(fd.get("category") || "supporting"));
    await addMovementNote(id, me.id, `Added ${names.join(", ")}`, "document_added");
    revalidatePath(`/portal/office/files/${id}`);
    return { ok: true, message: `${names.length} document(s) uploaded.` };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function archiveFile(id: string, archive: boolean): Promise<ActionResult> {
  try {
    await assertPermission("files.archive");
    const db = await createClient();
    must(await db.from("office_files").update({ status: archive ? "archived" : "completed" }).eq("id", id));
    revalidatePath(`/portal/office/files/${id}`);
    revalidatePath("/portal/office/files");
    return { ok: true, message: archive ? "File archived." : "File restored." };
  } catch (e) { return toActionError(e); }
}
