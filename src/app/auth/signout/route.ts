import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ROLE_COOKIE } from "@/lib/auth/session";

/** POST-only sign-out endpoint (avoids logout via cross-site GET). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const res = NextResponse.redirect(new URL("/login?signed_out=1", request.url), { status: 303 });
  res.cookies.delete(ACTIVE_ROLE_COOKIE);
  return res;
}
