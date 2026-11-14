"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty } from "@/lib/data/faculty";
import { storePrivateFile, removePrivateFile, UploadError } from "@/lib/storage";
import { toActionError, type ActionResult } from "@/lib/actions";

const meta = z.object({
  title: z.string().trim().min(2, "Enter a title").max(160),
  description: z.string().trim().max(1000).default(""),
  resource_kind: z.enum(["notes", "slides", "reading", "syllabus", "question_bank", "reference", "other"]),
});

export async function uploadResource(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { user } = await getMyFaculty();
    const offeringId = z.string().uuid("Choose a subject").parse(fd.get("offering_id"));
    const data = meta.parse(Object.fromEntries(fd));
    const supabase = await createClient();
    const { data: teaches } = await supabase.rpc("faculty_teaches_offering", { p_offering: offeringId });
    if (!teaches) return { ok: false, error: "You can only upload resources to subjects you teach." };
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file.", fieldErrors: { file: "Required" } };
    const stored = await storePrivateFile(file, `resources/${offeringId}`);
    const { error } = await supabase.from("study_resources").insert({
      offering_id: offeringId, ...data, storage_path: stored.path, file_name: stored.fileName, mime_type: stored.mime, size_bytes: stored.size,
      uploaded_by: user.id, is_published: fd.get("is_published") === "on",
    });
    if (error) { await removePrivateFile(stored.path); throw error; }
    revalidatePath("/portal/faculty/resources");
    return { ok: true, message: "Resource uploaded." };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function updateResource(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { user } = await getMyFaculty();
    const data = meta.parse(Object.fromEntries(fd));
    const supabase = await createClient();
    const { data: current } = await supabase.from("study_resources").select("storage_path, offering_id").eq("id", id).maybeSingle();
    if (!current) return { ok: false, error: "Resource not found." };
    const patch: Record<string, unknown> = { ...data, is_published: fd.get("is_published") === "on", uploaded_by: user.id };
    const file = fd.get("file");
    let oldPath: string | null = null;
    if (file instanceof File && file.size > 0) {
      const stored = await storePrivateFile(file, `resources/${current.offering_id}`);
      Object.assign(patch, { storage_path: stored.path, file_name: stored.fileName, mime_type: stored.mime, size_bytes: stored.size });
      oldPath = current.storage_path;
    }
    const { error } = await supabase.from("study_resources").update(patch).eq("id", id);
    if (error) throw error;
    if (oldPath) await removePrivateFile(oldPath);
    revalidatePath("/portal/faculty/resources");
    return { ok: true, message: "Resource updated." };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function deleteResource(id: string) {
  await getMyFaculty();
  const supabase = await createClient();
  const { data } = await supabase.from("study_resources").delete().eq("id", id).select("storage_path").maybeSingle();
  if (data) await removePrivateFile(data.storage_path);
  revalidatePath("/portal/faculty/resources");
}
