"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { storePublicImage, UploadError } from "@/lib/storage";
import { logSecurityEvent } from "@/lib/security";
import { toActionError, must, type ActionResult } from "@/lib/actions";

const SECTIONS = ["intro", "departments", "programmes", "achievements", "announcements", "news", "events", "gallery", "calendar", "faculty", "contact"];

export async function saveSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("settings.manage");
    const o = (n: number) => z.string().trim().max(n).transform((v) => v || null);
    const d = z.object({
      college_name: z.string().trim().min(3).max(160), short_name: z.string().trim().min(2).max(60), motto: z.string().trim().max(160),
      intro: z.string().trim().max(600), email: z.string().trim().email().or(z.literal("")).transform((v) => v || null), phone: o(40), address: o(300),
      map_url: z.string().trim().url().or(z.literal("")).transform((v) => v || null), affiliation: o(300), footer_text: o(400),
      established_year: z.coerce.number().int().min(1800).max(2100).or(z.literal("")).transform((v) => (v === "" ? null : v)).optional(),
      currency: z.string().regex(/^[A-Z]{3}$/), backup_notes: o(2000),
      require_mfa_privileged: z.string().optional().transform((v) => v === "on"),
      email_notifications: z.string().optional().transform((v) => v === "on"),
    }).parse(Object.fromEntries(fd));
    const home_sections = fd.getAll("home_sections").map(String).filter((s) => SECTIONS.includes(s));
    const db = await createClient();
    const row: Record<string, unknown> = { ...d, home_sections, updated_by: me.id };
    const logo = fd.get("logo");
    if (logo instanceof File && logo.size > 0) row.logo_path = await storePublicImage(logo, "branding", db);
    if (fd.get("remove_logo") === "on") row.logo_path = null;
    must(await db.from("site_settings").update(row).eq("id", 1));
    await logSecurityEvent("settings_changed", me.id, { mfa: d.require_mfa_privileged });
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}
