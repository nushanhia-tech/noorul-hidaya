"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty } from "@/lib/data/faculty";
import { toActionError, type ActionResult } from "@/lib/actions";

export async function updateFacultyProfile(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { faculty } = await getMyFaculty();
    const data = z.object({
      qualification: z.string().trim().max(200), specialization: z.string().trim().max(200), bio: z.string().trim().max(2000),
    }).parse(Object.fromEntries(fd));
    const supabase = await createClient();
    const { error } = await supabase.from("faculty").update(data).eq("id", faculty.id);
    if (error) throw error;
    revalidatePath("/portal/faculty/profile");
    revalidatePath("/faculty");
    return { ok: true, message: "Profile updated." };
  } catch (e) { return toActionError(e); }
}
