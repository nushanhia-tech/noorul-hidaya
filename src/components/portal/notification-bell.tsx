import { createClient } from "@/lib/supabase/server";
import type { Portal } from "@/lib/auth/roles";
import { BellPopover } from "./bell-popover";

export async function NotificationBell({ userId, portal }: { userId: string; portal: Portal }) {
  const supabase = await createClient();
  const [{ count }, { data }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    supabase.from("notifications").select("id, title, body, type, link, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
  ]);
  return <BellPopover unread={count ?? 0} items={data ?? []} allHref={`/portal/${portal}/notifications`} />;
}
