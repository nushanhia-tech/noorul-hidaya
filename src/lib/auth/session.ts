import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  type Portal, type Role, canEnterPortal, isRole, portalsForRoles, portalForRole, PRIVILEGED_ROLES,
} from "./roles";
import { hasPermission, type Permission } from "./permissions";
import { getSiteSettings } from "@/lib/data/site";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  avatarPath: string | null;
  roles: Role[];
  permissions: Set<string>;
  portals: Portal[];
};

export const ACTIVE_ROLE_COOKIE = "active_portal";

/** Verified current user (JWT validated by Supabase) with roles and permissions. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  // getClaims() verifies the JWT signature (locally with the project's signing
  // keys; via the Auth server for legacy keys) — no extra network hop per page.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  // One parallel round trip: profile + roles (embedded) + the small permission map.
  const [{ data: profile }, { data: perms }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, avatar_path, is_active, user_roles!user_roles_user_id_fkey(role)").eq("id", userId).maybeSingle(),
    supabase.from("role_permissions").select("role, permission_key"),
  ]);
  if (!profile || !profile.is_active) return null;

  const roles = ((profile.user_roles ?? []) as { role: string }[]).map((r) => r.role).filter(isRole);
  const permissions = new Set((perms ?? []).filter((p) => (roles as string[]).includes(p.role)).map((p) => p.permission_key as string));
  return {
    id: userId,
    email: profile.email ?? (claimsData?.claims?.email as string | undefined) ?? "",
    fullName: profile.full_name,
    avatarPath: profile.avatar_path,
    roles,
    permissions,
    portals: portalsForRoles(roles),
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Enforce MFA rules for the current session (aal2 when a factor exists; setup when required). */
export async function enforceMfa(user: SessionUser, opts: { allowSetup?: boolean } = {}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") redirect("/login/mfa");
  if (!opts.allowSetup && data && data.nextLevel !== "aal2" && user.roles.some((r) => PRIVILEGED_ROLES.includes(r))) {
    const settings = await getSiteSettings();
    if (settings.require_mfa_privileged) redirect("/portal/account/security?required=1");
  }
}

/** Gate for a portal layout. Server-side; URL changes cannot bypass it. */
export async function requirePortal(portal: Portal): Promise<SessionUser> {
  const user = await requireUser();
  if (!canEnterPortal(user.roles, portal)) redirect("/forbidden");
  await enforceMfa(user);
  return user;
}

/** Gate for server actions and route handlers. Throws instead of redirecting. */
export async function assertPermission(permission: Permission | Permission[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("You are not signed in.");
  if (!hasPermission(user.permissions, permission)) throw new AuthError("You do not have permission to do that.");
  return user;
}

export async function assertPortal(portal: Portal): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("You are not signed in.");
  if (!canEnterPortal(user.roles, portal)) throw new AuthError("You do not have access to this portal.");
  return user;
}

export function can(user: SessionUser, permission: Permission | Permission[]) {
  return hasPermission(user.permissions, permission);
}

export async function getActivePortal(user: SessionUser): Promise<Portal | null> {
  const value = (await cookies()).get(ACTIVE_ROLE_COOKIE)?.value as Portal | undefined;
  if (value && user.portals.includes(value)) return value;
  return user.portals[0] ?? (user.roles[0] ? portalForRole(user.roles[0]) : null);
}

export class AuthError extends Error {}
