import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

async function clientMeta() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown",
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}

/** Essential security event recording (sign-ins, password and role changes, denials). */
export async function logSecurityEvent(event: string, userId: string | null, metadata: Record<string, unknown> = {}) {
  if (!serverEnv().serviceRoleKey) return;
  try {
    const { ip, userAgent } = await clientMeta();
    await createAdminClient().from("security_events").insert({ event, user_id: userId, ip, user_agent: userAgent, metadata });
  } catch (e) {
    console.error("[security-log]", e);
  }
}

/**
 * Database-backed fixed-window rate limiter (works across serverless instances).
 * Returns true when the request is allowed. Fails open only if the server is
 * not configured with a service key (local development).
 */
export async function rateLimit(bucket: string, max: number, windowSeconds: number, identity?: string) {
  if (!serverEnv().serviceRoleKey) return true;
  const { ip } = await clientMeta();
  const key = `${bucket}:${identity ?? ip}`;
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) {
    console.error("[rate-limit]", error);
    return false;
  }
  return data === true;
}
