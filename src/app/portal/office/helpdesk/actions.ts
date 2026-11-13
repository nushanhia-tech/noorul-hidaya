"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { attachFiles, filesFrom } from "@/lib/documents";
import { UploadError } from "@/lib/storage";
import { toActionError, must, type ActionResult } from "@/lib/actions";

const refresh = (id: string) => { revalidatePath("/portal/office/helpdesk"); revalidatePath(`/portal/office/helpdesk/${id}`); };

export async function updateTicket(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("helpdesk.handle");
    const d = z.object({
      status: z.enum(["open", "assigned", "in_progress", "waiting_student", "resolved", "closed"]),
      priority: z.enum(["low", "normal", "high", "urgent"]),
      assigned_to: z.string().uuid().optional().or(z.literal("")).transform((v) => v || null),
    }).parse(Object.fromEntries(fd));
    if (d.assigned_to && d.assigned_to !== me.id && !me.permissions.has("helpdesk.view_all")) return { ok: false, error: "Only supervisors can assign tickets to other staff." };
    const db = await createClient();
    must(await db.from("tickets").update(d).eq("id", id));
    refresh(id);
    return { ok: true, message: "Ticket updated. The student has been notified of status changes." };
  } catch (e) { return toActionError(e); }
}

export async function takeTicket(id: string): Promise<ActionResult> {
  try {
    const me = await assertPermission("helpdesk.handle");
    const db = await createClient();
    must(await db.from("tickets").update({ assigned_to: me.id }).eq("id", id).is("assigned_to", null));
    refresh(id);
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function staffReply(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("helpdesk.handle");
    const d = z.object({ body: z.string().trim().min(1, "Write a message").max(5000), kind: z.enum(["reply", "request_info", "internal"]) }).parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("ticket_messages").insert({ ticket_id: id, author_id: me.id, body: d.body, is_internal: d.kind === "internal" }));
    if (d.kind === "request_info") must(await db.from("tickets").update({ status: "waiting_student" }).eq("id", id));
    const files = filesFrom(fd);
    if (files.length) await attachFiles("ticket", id, me.id, files);
    refresh(id);
    return { ok: true, message: d.kind === "internal" ? "Internal note added (not visible to the student)." : "Reply sent to the student." };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function escalateTicket(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("helpdesk.handle");
    const d = z.object({ escalated_to: z.string().uuid("Choose a supervisor"), note: z.string().trim().min(5, "Explain why").max(1000) }).parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("tickets").update({ escalated_to: d.escalated_to, priority: "high" }).eq("id", id));
    must(await db.from("ticket_messages").insert({ ticket_id: id, author_id: me.id, body: `Escalated: ${d.note}`, is_internal: true }));
    refresh(id);
    return { ok: true, message: "Escalated to the supervisor." };
  } catch (e) { return toActionError(e); }
}
