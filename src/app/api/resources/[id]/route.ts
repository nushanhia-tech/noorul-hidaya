import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";

/** Study resource download: RLS decides visibility; then a 60-second signed URL is issued. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorised", { status: 401 });
  const { data } = await supabase.from("study_resources").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(await signedUrl(data.storage_path, data.file_name));
}
