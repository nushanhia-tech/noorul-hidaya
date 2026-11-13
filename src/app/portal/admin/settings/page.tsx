import { requirePortal } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/data/site";
import { SettingsForm } from "./form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePortal("admin");
  const db = await createClient();
  const { data } = await db.from("site_settings").select("*").eq("id", 1).maybeSingle();
  const s = { ...DEFAULT_SETTINGS, ...(data ?? {}) } as SiteSettings;
  return (
    <>
      <PageHeader title="Settings" description="College identity, contact details, website layout, security and backups." />
      <SettingsForm s={s} />
    </>
  );
}
