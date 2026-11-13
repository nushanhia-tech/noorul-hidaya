"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { logSecurityEvent, rateLimit } from "@/lib/security";
import { resetSite } from "@/lib/reset";
import type { ActionResult } from "@/lib/actions";

export async function fullReset(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await assertPermission(["settings.manage"]).catch(() => null);
  if (!me || !me.roles.includes("admin") || !me.permissions.has("users.manage") || !me.permissions.has("roles.manage")) {
    return { ok: false, error: "Only an administrator can reset the site." };
  }
  const d = z.object({ confirm: z.string(), password: z.string().min(1), reset_settings: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!d.success || d.data.confirm !== "RESET") return { ok: false, error: 'Type RESET (in capital letters) to confirm.', fieldErrors: { confirm: "Type RESET" } };
  if (!(await rateLimit("site-reset", 3, 3600, me.id))) return { ok: false, error: "Too many attempts. Try again later." };

  const supabase = await createClient();
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: me.email, password: d.data.password });
  if (authErr) {
    await logSecurityEvent("site_reset_denied", me.id);
    return { ok: false, error: "Your password is incorrect.", fieldErrors: { password: "Incorrect password" } };
  }
  await logSecurityEvent("site_reset_started", me.id);
  try {
    const r = await resetSite(me.id, { resetSettings: d.data.reset_settings === "on" });
    await logSecurityEvent("site_reset_completed", me.id, r);
    revalidatePath("/", "layout");
    return { ok: true, message: `Site reset complete. ${r.usersDeleted} user account(s) and ${r.filesDeleted} file(s) deleted. Your administrator account was kept.` };
  } catch (e) {
    await logSecurityEvent("site_reset_failed", me.id, { error: (e as Error).message });
    return { ok: false, error: `Reset stopped part-way: ${(e as Error).message}. Run it again to finish.` };
  }
}
