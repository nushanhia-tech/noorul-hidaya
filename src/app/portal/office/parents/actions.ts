"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { toActionError, must, type ActionResult } from "@/lib/actions";

export async function replyToParent(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("parents.respond");
    const body = z.string().trim().min(1, "Write a reply").max(4000).parse(fd.get("body"));
    const db = await createClient();
    must(await db.from("parent_messages").insert({ thread_id: id, author_id: me.id, body }));
    revalidatePath(`/portal/office/parents/${id}`);
    return { ok: true, message: "Reply sent. The parent has been notified." };
  } catch (e) { return toActionError(e); }
}

export async function setThreadStatus(id: string, status: "open" | "closed") {
  await assertPermission("parents.respond");
  const db = await createClient();
  await db.from("parent_threads").update({ status }).eq("id", id);
  revalidatePath(`/portal/office/parents/${id}`);
  revalidatePath("/portal/office/parents");
}
