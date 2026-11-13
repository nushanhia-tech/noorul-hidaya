import "server-only";
import { getSiteSettings } from "@/lib/data/site";
import type { Letterhead } from "./document";

export async function getLetterhead(): Promise<Letterhead> {
  const s = await getSiteSettings();
  return { collegeName: s.college_name, address: s.address, phone: s.phone, email: s.email };
}
