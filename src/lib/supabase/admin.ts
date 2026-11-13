import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS — use only on the server, only after an
 * explicit authorisation check, and only for operations users cannot do
 * themselves (auth admin, signed URLs for private documents, security logs).
 */
export function createAdminClient() {
  const key = serverEnv().serviceRoleKey;
  if (!publicEnv.supabaseUrl || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  }
  return createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
