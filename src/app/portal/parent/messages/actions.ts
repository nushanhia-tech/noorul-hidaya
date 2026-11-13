"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLinkedStudents } from "@/lib/data/parent";
import { rateLimit } from "@/lib/security";
import { toActionError, type ActionResult } from "@/lib/actions";

export async function startThread(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { user, students } = await getLinkedStudents();
    const data = z.object({
      student_id: z.string().uuid("Choose a student"),
      subject: z.string().trim().min(4, "Subject is too short").max(160),
      body: z.string().trim().min(5, "Write your message").max(4000),
    }).parse(Object.fromEntries(fd));
    if (!students.some((s) => s.student_id === data.student_id)) return { ok: false, error: "You are not authorised for this student." };
    if (!(await rateLimit("parent-thread", 10, 3600, user.id))) return { ok: false, error: "Too many messages. Please try again later." };
    const supabase = await createClient();
    const { data: t, error } = await supabase.from("parent_threads").insert({ parent_id: user.id, student_id: data.student_id, subject: data.subject }).select("id").single();
    if (error) throw error;
    const m = await supabase.from("parent_messages").insert({ thread_id: t.id, author_id: user.id, body: data.body });
    if (m.error) throw m.error;
    revalidatePath("/portal/parent/messages");
    return { ok: true, redirectTo: `/portal/parent/messages/${t.id}` };
  } catch (e) { return toActionError(e); }
}

export async function replyThread(threadId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { user } = await getLinkedStudents();
    const body = z.string().trim().min(1, "Write a message").max(4000).parse(fd.get("body"));
    const supabase = await createClient();
    const { error } = await supabase.from("parent_messages").insert({ thread_id: threadId, author_id: user.id, body });
    if (error) throw error;
    revalidatePath(`/portal/parent/messages/${threadId}`);
    return { ok: true, message: "Message sent." };
  } catch (e) { return toActionError(e); }
}
