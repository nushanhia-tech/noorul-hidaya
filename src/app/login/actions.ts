"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, resetSchema, type LoginInput } from "@/lib/validation/auth";
import { rateLimit, logSecurityEvent } from "@/lib/security";
import { isRole, postLoginDestination, portalPath, type Portal } from "@/lib/auth/roles";
import { ACTIVE_ROLE_COOKIE, getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { toActionError, type ActionResult } from "@/lib/actions";
import { z } from "zod";

const GENERIC = "The email or password is incorrect.";

export async function signIn(input: LoginInput): Promise<ActionResult> {
  try {
    if (!isSupabaseConfigured()) return { ok: false, error: "Sign-in is unavailable: the database is not configured yet." };
    const { email, password, next } = loginSchema.parse(input);
    const allowedIp = await rateLimit("login-ip", 20, 900);
    const allowedAccount = await rateLimit("login-account", 8, 900, email.toLowerCase());
    if (!allowedIp || !allowedAccount) {
      await logSecurityEvent("login_rate_limited", null, { email });
      return { ok: false, error: "Too many sign-in attempts. Please wait 15 minutes and try again." };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      await logSecurityEvent("login_failed", null, { email });
      return { ok: false, error: error?.message?.toLowerCase().includes("email not confirmed") ? "Please confirm your email address first." : GENERIC };
    }
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    ]);
    if (!profile?.is_active) {
      await supabase.auth.signOut();
      await logSecurityEvent("login_blocked_inactive", data.user.id);
      return { ok: false, error: "This account has been deactivated. Please contact the college office." };
    }
    const roleList = (roles ?? []).map((r) => r.role).filter(isRole);
    if (!roleList.length) {
      await supabase.auth.signOut();
      return { ok: false, error: "Your account has no portal access yet. Please contact the college office." };
    }
    await logSecurityEvent("login_success", data.user.id);

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const destination = postLoginDestination(roleList, next);
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      return { ok: true, redirectTo: `/login/mfa?next=${encodeURIComponent(destination)}` };
    }
    return { ok: true, redirectTo: destination };
  } catch (e) {
    return toActionError(e);
  }
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const user = await getSessionUser();
    await supabase.auth.signOut({ scope: "local" });
    if (user) await logSecurityEvent("logout", user.id);
  }
  (await cookies()).delete(ACTIVE_ROLE_COOKIE);
  redirect("/login?signed_out=1");
}

export async function choosePortal(portal: Portal) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.portals.includes(portal)) redirect("/forbidden");
  (await cookies()).set(ACTIVE_ROLE_COOKIE, portal, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect(portalPath(portal));
}

export async function requestPasswordReset(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const email = z.string().trim().email("Enter a valid email address").parse(fd.get("email"));
    if (!(await rateLimit("reset", 5, 3600)) || !(await rateLimit("reset-account", 3, 3600, email.toLowerCase()))) {
      return { ok: false, error: "Too many requests. Please try again later." };
    }
    const supabase = await createClient();
    const h = await headers();
    const origin = h.get("origin") ?? publicEnv.siteUrl;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/reset-password` });
    await logSecurityEvent("password_reset_requested", null, { email });
    // Same response whether or not the account exists (no account enumeration).
    return { ok: true, message: "If an account exists for that address, a reset link has been sent. The link expires in one hour." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function completePasswordReset(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { password } = resetSchema.parse(Object.fromEntries(fd));
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, error: "Your reset link has expired. Please request a new one." };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: error.message };
    await logSecurityEvent("password_reset_completed", auth.user.id);
    await supabase.auth.signOut({ scope: "others" });
    return { ok: true, redirectTo: "/login?reset=1" };
  } catch (e) {
    return toActionError(e);
  }
}

export async function verifyMfa(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const code = z.string().regex(/^\d{6}$/, "Enter the 6-digit code").parse(fd.get("code"));
    const next = String(fd.get("next") ?? "/select-role");
    if (!(await rateLimit("mfa", 10, 900))) return { ok: false, error: "Too many attempts. Please wait and try again." };
    const supabase = await createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === "verified");
    if (!factor) return { ok: false, error: "No authenticator is set up for this account." };
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    const { data: auth } = await supabase.auth.getUser();
    if (error) {
      await logSecurityEvent("mfa_failed", auth.user?.id ?? null);
      return { ok: false, error: "That code is not valid. Check your authenticator app and try again." };
    }
    await logSecurityEvent("mfa_verified", auth.user?.id ?? null);
    return { ok: true, redirectTo: next.startsWith("/") && !next.startsWith("//") ? next : "/select-role" };
  } catch (e) {
    return toActionError(e);
  }
}
