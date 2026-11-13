"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent } from "@/lib/data/student";
import { attachFiles, filesFrom } from "@/lib/documents";
import { rateLimit } from "@/lib/security";
import { UploadError } from "@/lib/storage";
import { TICKET_CATEGORIES } from "@/lib/constants";
import { toActionError, type ActionResult } from "@/lib/actions";

const ticketSchema = z.object({
  category: z.enum(Object.keys(TICKET_CATEGORIES) as [string, ...string[]], { message: "Choose a category" }),
  subject: z.string().trim().min(4, "Subject is too short").max(160),
  description: z.string().trim().min(10, "Please describe your request (at least 10 characters)").max(5000),
});

export async function createTicket(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { user, student } = await getMyStudent();
    const data = ticketSchema.parse(Object.fromEntries(fd));
    if (!(await rateLimit("ticket-create", 10, 3600, user.id))) return { ok: false, error: "You have raised many requests recently. Please wait before creating another." };
    const supabase = await createClient();
    const { data: ticket, error } = await supabase.from("tickets")
      .insert({ ...data, requester_id: user.id, student_id: student.id }).select("id").single();
    if (error) throw error;
    const files = filesFrom(fd);
    if (files.length) await attachFiles("ticket", ticket.id, user.id, files);
    revalidatePath("/portal/student/helpdesk");
    return { ok: true, redirectTo: `/portal/student/helpdesk/${ticket.id}` };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: `Your request was created, but an attachment failed: ${e.message}` };
    return toActionError(e);
  }
}

export async function replyToTicket(ticketId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { user } = await getMyStudent();
    const body = z.string().trim().min(1, "Write a message").max(5000).parse(fd.get("body"));
    const supabase = await createClient();
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: ticketId, author_id: user.id, body });
    if (error) throw error;
    const files = filesFrom(fd);
    if (files.length) await attachFiles("ticket", ticketId, user.id, files);
    revalidatePath(`/portal/student/helpdesk/${ticketId}`);
    return { ok: true, message: "Reply sent." };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function setOwnTicketStatus(ticketId: string, status: "closed" | "open"): Promise<void> {
  await getMyStudent();
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").update({ status }).eq("id", ticketId);
  if (error) throw new Error(error.message);
  revalidatePath(`/portal/student/helpdesk/${ticketId}`);
}
