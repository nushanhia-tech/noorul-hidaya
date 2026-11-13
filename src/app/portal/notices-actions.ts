"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { toActionError, must, type ActionResult } from "@/lib/actions";

const AUD = ["public", "student", "faculty", "parent", "office"] as const;

/** Publishing a notice triggers in-app notifications for its audience (database trigger). */
export async function saveNotice(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("notices.publish");
    const audience = fd.getAll("audience").map(String).filter((a): a is (typeof AUD)[number] => (AUD as readonly string[]).includes(a));
    if (!audience.length) return { ok: false, error: "Choose at least one audience.", fieldErrors: { audience: "Required" } };
    const d = z.object({
      title: z.string().trim().min(4, "Title is too short").max(200), body: z.string().trim().max(10000),
      category: z.enum(["general", "academic", "examination", "administrative", "fee", "event"]),
      status: z.enum(["draft", "published"]), expires_on: z.string().optional().transform((v) => v || null),
      is_important: z.string().optional().transform((v) => v === "on"),
    }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const row = { ...d, audience, ...(id ? {} : { created_by: me.id }) };
    if (id) must(await db.from("notices").update(row).eq("id", id));
    else must(await db.from("notices").insert(row));
    revalidatePath("/", "layout");
    return { ok: true, message: d.status === "published" ? "Notice published and recipients notified." : "Draft saved." };
  } catch (e) { return toActionError(e); }
}

export async function deleteNotice(id: string) {
  await assertPermission("notices.publish");
  const db = await createClient();
  await db.from("notices").delete().eq("id", id);
  revalidatePath("/", "layout");
}
