"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { isRole } from "@/lib/auth/roles";
import { logSecurityEvent } from "@/lib/security";
import { toActionError, must, type ActionResult } from "@/lib/actions";

export async function saveMatrix(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("roles.manage");
    const wanted = new Set(fd.getAll("grant").map(String));
    const db = await createClient();
    const { data: current } = await db.from("role_permissions").select("role, permission_key");
    const have = new Set((current ?? []).map((r) => `${r.role}|${r.permission_key}`));
    const add = [...wanted].filter((k) => !have.has(k)).map((k) => k.split("|")).filter(([r]) => isRole(r));
    const remove = [...have].filter((k) => !wanted.has(k)).map((k) => k.split("|"));
    const locked = remove.filter(([r, p]) => r === "admin" && (p === "roles.manage" || p === "users.manage"));
    if (locked.length) return { ok: false, error: "Administrators must keep users.manage and roles.manage." };
    if (add.length) must(await db.from("role_permissions").insert(add.map(([role, permission_key]) => ({ role, permission_key }))));
    for (const [role, key] of remove) must(await db.from("role_permissions").delete().eq("role", role).eq("permission_key", key));
    await logSecurityEvent("permissions_changed", me.id, { added: add.map((a) => a.join(":")), removed: remove.map((a) => a.join(":")) });
    revalidatePath("/portal", "layout");
    return { ok: true, message: `Saved: ${add.length} granted, ${remove.length} revoked. Changes apply immediately, including database access rules.` };
  } catch (e) { return toActionError(e); }
}
