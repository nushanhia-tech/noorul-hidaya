import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";

export type SiteSettings = {
  college_name: string; short_name: string; motto: string; intro: string; logo_path: string | null;
  email: string | null; phone: string | null; address: string | null; map_url: string | null;
  established_year: number | null; affiliation: string | null; footer_text: string | null;
  social: Record<string, string>; home_sections: string[]; currency: string;
  require_mfa_privileged: boolean; email_notifications: boolean; backup_notes: string | null;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  college_name: "Your College Name", short_name: "College", motto: "Knowledge with character", intro: "",
  logo_path: null, email: null, phone: null, address: null, map_url: null, established_year: null,
  affiliation: null, footer_text: null, social: {}, home_sections: ["intro","departments","programmes","achievements","announcements","news","events","gallery","calendar","faculty","contact"],
  currency: "INR", require_mfa_privileged: false, email_notifications: true, backup_notes: null,
};

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const db = createPublicClient();
  if (!db) return DEFAULT_SETTINGS;
  const { data } = await db.from("site_settings").select("*").eq("id", 1).maybeSingle();
  return data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
});
