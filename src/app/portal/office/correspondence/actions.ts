"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { attachFiles, filesFrom } from "@/lib/documents";
import { UploadError } from "@/lib/storage";
import { toActionError, must, type ActionResult } from "@/lib/actions";

const o = (n: number) => z.string().trim().max(n).optional().transform((v) => v || null);
const uuidOpt = z.string().uuid().optional().or(z.literal("")).transform((v) => v || null);
const MODE = z.enum(["post", "registered_post", "speed_post", "courier", "email", "hand_delivery", "fax"]).optional().or(z.literal("")).transform((v) => v || null);
const refresh = (id?: string) => { revalidatePath("/portal/office/correspondence"); if (id) revalidatePath(`/portal/office/correspondence/${id}`); };

export async function registerLetter(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("letters.manage");
    const direction = z.enum(["inward", "outward"]).parse(fd.get("direction"));
    const base = z.object({
      subject: z.string().trim().min(3, "Enter a subject").max(250), description: z.string().trim().max(5000).default(""),
      letter_date: z.string().min(1, "Letter date required"), department_id: uuidOpt, file_id: uuidOpt, mode: MODE, external_ref: o(80),
    }).parse(Object.fromEntries(fd));
    let extra: Record<string, unknown>;
    if (direction === "inward") {
      extra = z.object({ sender_name: z.string().trim().min(2, "Sender is required").max(200), sender_address: o(500), received_on: z.string().min(1, "Received date required"), recipient_name: o(200) }).parse(Object.fromEntries(fd));
      extra.status = "received";
    } else {
      extra = z.object({ recipient_name: z.string().trim().min(2, "Recipient is required").max(200), recipient_address: o(500), body: o(20000), template_id: uuidOpt }).parse(Object.fromEntries(fd));
      extra.status = "draft";
    }
    const db = await createClient();
    const { data, error } = await db.from("letters").insert({ ...base, ...extra, direction, reference_no: "", created_by: me.id }).select("id").single();
    if (error) throw error;
    const files = filesFrom(fd);
    if (files.length) await attachFiles("letter", data.id, me.id, files, "correspondence");
    refresh();
    return { ok: true, redirectTo: `/portal/office/correspondence/${data.id}` };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function updateLetter(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("letters.manage");
    const d = z.object({
      status: z.enum(["received", "under_action", "closed", "draft", "ready", "dispatched", "delivered", "returned"]),
      mode: MODE, tracking_no: o(80), dispatched_on: z.string().optional().transform((v) => v || null), file_id: uuidOpt,
      body: z.string().max(20000).optional(), acknowledgement_note: o(500), acknowledged: z.string().optional(),
    }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const { data: cur } = await db.from("letters").select("acknowledged_at, direction").eq("id", id).single();
    const patch: Record<string, unknown> = { status: d.status, mode: d.mode, tracking_no: d.tracking_no, file_id: d.file_id, acknowledgement_note: d.acknowledgement_note };
    if (cur?.direction === "outward") {
      if (d.body !== undefined) patch.body = d.body;
      patch.dispatched_on = d.dispatched_on ?? (["dispatched", "delivered", "returned"].includes(d.status) ? new Date().toISOString().slice(0, 10) : null);
    }
    if (d.acknowledged === "on" && !cur?.acknowledged_at) patch.acknowledged_at = new Date().toISOString();
    if (d.acknowledged !== "on") patch.acknowledged_at = null;
    must(await db.from("letters").update(patch).eq("id", id));
    refresh(id);
    return { ok: true, message: "Letter updated." };
  } catch (e) { return toActionError(e); }
}

export async function archiveLetter(id: string, archive: boolean): Promise<ActionResult> {
  try {
    await assertPermission("letters.manage");
    const db = await createClient();
    must(await db.from("letters").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id));
    refresh(id);
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function addLetterDocuments(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("letters.manage");
    const n = await attachFiles("letter", id, me.id, filesFrom(fd), "correspondence");
    refresh(id);
    return { ok: true, message: `${n.length} file(s) attached.` };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function saveTemplate(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("letters.manage");
    const d = z.object({ name: z.string().trim().min(2).max(120), subject: z.string().trim().min(2).max(250), body: z.string().trim().min(10).max(20000), is_active: z.string().optional().transform((v) => v === "on") }).parse(Object.fromEntries(fd));
    const db = await createClient();
    if (id) must(await db.from("letter_templates").update(d).eq("id", id));
    else must(await db.from("letter_templates").insert({ ...d, created_by: me.id }));
    revalidatePath("/portal/office/correspondence/templates");
    return { ok: true, message: "Template saved." };
  } catch (e) { return toActionError(e); }
}
