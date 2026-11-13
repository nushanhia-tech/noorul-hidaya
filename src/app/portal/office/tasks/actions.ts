"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPortal } from "@/lib/auth/session";
import { attachFiles, filesFrom } from "@/lib/documents";
import { UploadError } from "@/lib/storage";
import { toActionError, must, type ActionResult } from "@/lib/actions";

const uuidOpt = z.string().uuid().optional().or(z.literal("")).transform((v) => v || null);
const STATUS = z.enum(["todo", "in_progress", "waiting", "completed", "cancelled"]);
const refresh = (id?: string) => { revalidatePath("/portal/office/tasks"); if (id) revalidatePath(`/portal/office/tasks/${id}`); };

export async function createTask(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPortal("office");
    const d = z.object({
      title: z.string().trim().min(3, "Enter a title").max(200), instructions: z.string().trim().max(5000).default(""),
      priority: z.enum(["low", "normal", "high", "urgent"]), due_on: z.string().optional().transform((v) => v || null),
      assigned_to: uuidOpt, file_id: uuidOpt, ticket_id: uuidOpt,
    }).parse(Object.fromEntries(fd));
    const assignee = d.assigned_to ?? me.id;
    if (assignee !== me.id && !me.permissions.has("tasks.assign")) return { ok: false, error: "You can create tasks for yourself only. Ask a supervisor to assign tasks to others." };
    const db = await createClient();
    const { data, error } = await db.from("office_tasks").insert({ ...d, assigned_to: assignee, created_by: me.id }).select("id").single();
    if (error) throw error;
    const files = filesFrom(fd);
    if (files.length) await attachFiles("task", data.id, me.id, files);
    refresh();
    return { ok: true, redirectTo: `/portal/office/tasks/${data.id}` };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function setTaskStatus(id: string, status: string): Promise<ActionResult> {
  try {
    await assertPortal("office");
    const s = STATUS.parse(status);
    const db = await createClient();
    must(await db.from("office_tasks").update({ status: s }).eq("id", id));
    refresh(id);
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function updateTask(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPortal("office");
    const d = z.object({
      title: z.string().trim().min(3).max(200), instructions: z.string().trim().max(5000), priority: z.enum(["low", "normal", "high", "urgent"]),
      due_on: z.string().optional().transform((v) => v || null), assigned_to: uuidOpt, status: STATUS,
    }).parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("office_tasks").update(d).eq("id", id));
    refresh(id);
    return { ok: true, message: "Task updated." };
  } catch (e) { return toActionError(e); }
}

export async function commentOnTask(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPortal("office");
    const body = z.string().trim().min(1, "Write a comment").max(4000).parse(fd.get("body"));
    const db = await createClient();
    must(await db.from("task_comments").insert({ task_id: id, author_id: me.id, body }));
    refresh(id);
    return { ok: true, message: "Comment added." };
  } catch (e) { return toActionError(e); }
}
