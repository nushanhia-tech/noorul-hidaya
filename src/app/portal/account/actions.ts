"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/validation/auth";
import { logSecurityEvent, rateLimit } from "@/lib/security";
import { storePublicImage, UploadError } from "@/lib/storage";
import { toActionError, type ActionResult } from "@/lib/actions";

export async function updateContact(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = z.object({
      phone: z.string().trim().max(20).regex(/^[0-9+() -]*$/, "Enter a valid phone number"),
      email_notifications: z.string().optional(),
    }).parse(Object.fromEntries(fd));
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({
      phone: data.phone || null, notification_prefs: { email: data.email_notifications === "on" },
    }).eq("id", user.id);
    if (error) throw error;
    revalidatePath("/portal", "layout");
    return { ok: true, message: "Your details have been saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateAvatar(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const file = fd.get("avatar");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
    const admin = createAdminClient();
    const path = await storePublicImage(file, `avatars/${user.id}`, admin);
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
    if (error) throw error;
    revalidatePath("/portal", "layout");
    return { ok: true, message: "Profile photo updated." };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function changePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { current, password } = changePasswordSchema.parse(Object.fromEntries(fd));
    if (!(await rateLimit("change-password", 5, 900, user.id))) return { ok: false, error: "Too many attempts. Please wait and try again." };
    const supabase = await createClient();
    // Re-authenticate with the current password before changing it.
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (authErr) {
      await logSecurityEvent("password_change_failed", user.id);
      return { ok: false, error: "Your current password is incorrect.", fieldErrors: { current: "Incorrect password" } };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: error.message };
    await supabase.auth.signOut({ scope: "others" });
    await logSecurityEvent("password_changed", user.id);
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function startTotpEnrolment(): Promise<{ ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { ok: false, error: error?.message ?? "Could not start enrolment." };
  await logSecurityEvent("mfa_enrol_started", user.id);
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTotpEnrolment(factorId: string, code: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code." };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { ok: false, error: "That code is not valid. Try again." };
  await logSecurityEvent("mfa_enabled", user.id);
  revalidatePath("/portal/account/security");
  return { ok: true, message: "Two-step verification is now on." };
}

export async function removeFactor(factorId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return { ok: false, error: "Verify with your authenticator before removing it." };
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: error.message };
  await logSecurityEvent("mfa_disabled", user.id);
  revalidatePath("/portal/account/security");
  return { ok: true, message: "Authenticator removed." };
}
