"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent } from "@/lib/data/student";
import { toActionError, type ActionResult } from "@/lib/actions";

const phone = z.string().trim().max(20).regex(/^[0-9+() -]*$/, "Enter a valid phone number");

/** Students may edit only personal contact details; official identifiers are protected by a DB guard. */
export async function updateStudentProfile(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { user, student } = await getMyStudent();
    const data = z.object({
      phone, address: z.string().trim().max(500), guardian_phone: phone, emergency_contact: z.string().trim().max(120),
    }).parse(Object.fromEntries(fd));
    const supabase = await createClient();
    const [a, b] = await Promise.all([
      supabase.from("students").update({ address: data.address || null, guardian_phone: data.guardian_phone || null, emergency_contact: data.emergency_contact || null }).eq("id", student.id),
      supabase.from("profiles").update({ phone: data.phone || null }).eq("id", user.id),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    revalidatePath("/portal/student/profile");
    return { ok: true, message: "Your details have been updated." };
  } catch (e) {
    return toActionError(e);
  }
}
