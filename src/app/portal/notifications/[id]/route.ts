import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSafeNext } from "@/lib/auth/roles";

/** Opens a notification: marks it read (RLS: own rows only) and follows its link. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("link").eq("id", id).maybeSingle();
  if (data) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  const target = data?.link && isSafeNext(data.link) ? data.link : "/select-role";
  return NextResponse.redirect(new URL(target, request.url));
}
