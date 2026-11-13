import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSafeNext } from "@/lib/auth/roles";

/** Handles email links (password recovery, invitations) using the token-hash flow. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/select-role";
  const next = isSafeNext(nextParam) ? nextParam : "/select-role";
  const supabase = await createClient();

  let ok = false;
  if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;

  const dest = request.nextUrl.clone();
  dest.search = "";
  if (ok) {
    dest.pathname = type === "recovery" || type === "invite" ? "/reset-password" : next;
  } else {
    dest.pathname = "/login";
    dest.searchParams.set("error", "link_expired");
  }
  return NextResponse.redirect(dest);
}
