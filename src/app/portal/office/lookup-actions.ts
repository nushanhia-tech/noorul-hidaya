"use server";
import { createClient } from "@/lib/supabase/server";
import { assertPortal } from "@/lib/auth/session";

export async function searchStudents(q: string): Promise<{ id: string; label: string }[]> {
  await assertPortal("office");
  const t = q.trim().replace(/[%_,()]/g, "").slice(0, 60);
  if (t.length < 2) return [];
  const db = await createClient();
  const [a, b] = await Promise.all([
    db.from("students").select("id, register_no, profiles(full_name)").ilike("register_no", `%${t}%`).limit(8),
    db.from("students").select("id, register_no, profiles!inner(full_name)").ilike("profiles.full_name", `%${t}%`).limit(8),
  ]);
  const map = new Map<string, string>();
  for (const s of [...(a.data ?? []), ...(b.data ?? [])]) map.set(s.id, `${(s.profiles as unknown as { full_name: string }).full_name} (${s.register_no})`);
  return [...map.entries()].map(([id, label]) => ({ id, label }));
}
