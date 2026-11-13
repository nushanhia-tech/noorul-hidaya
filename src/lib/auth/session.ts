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
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, avatar_path, is_active").eq("id", auth.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
  ]);
  if (!profile || !profile.is_active) return null;

  const roles = (roleRows ?? []).map((r) => r.role).filter(isRole);
  let permissions = new Set<string>();
  if (roles.length) {
    const { data: perms } = await supabase.from("role_permissions").select("permission_key").in("role", roles);
    permissions = new Set((perms ?? []).map((p) => p.permission_key as string));
  }
  return {
    id: auth.user.id,
    email: profile.email ?? auth.user.email ?? "",
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
export async function enforceMfa(user: SessionUser) {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") redirect("/login/mfa");
  if (data && data.nextLevel !== "aal2" && user.roles.some((r) => PRIVILEGED_ROLES.includes(r))) {
    const { data: settings } = await supabase.from("site_settings").select("require_mfa_privileged").eq("id", 1).maybeSingle();
    if (settings?.require_mfa_privileged) redirect("/portal/account/security?required=1");
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
