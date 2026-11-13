import "server-only";
import { createClient } from "@/lib/supabase/server";
import { storePrivateFile, removePrivateFile, UploadError } from "@/lib/storage";

type EntityType = "office_file" | "ticket" | "letter" | "task" | "parent_thread";

/**
 * Attach uploaded files to a record. Bytes go to the private bucket; the
 * metadata row is inserted with the user's session so RLS re-checks access.
 * If the metadata insert is refused, the stored object is removed again.
 */
export async function attachFiles(entityType: EntityType, entityId: string, userId: string, files: File[], category = "supporting") {
  const supabase = await createClient();
  const real = files.filter((f) => f instanceof File && f.size > 0);
  if (real.length > 5) throw new UploadError("Attach at most 5 files at a time.");
  // Verify access before uploading anything.
  const { data: allowed } = await supabase.rpc("can_access_entity", { p_type: entityType, p_id: entityId });
  if (!allowed) throw new UploadError("You cannot attach files to this record.");
  const saved: string[] = [];
  for (const file of real) {
    const stored = await storePrivateFile(file, `${entityType}/${entityId}`);
    const { error } = await supabase.from("documents").insert({
      entity_type: entityType, entity_id: entityId, category, storage_path: stored.path, file_name: stored.fileName,
      mime_type: stored.mime, size_bytes: stored.size, uploaded_by: userId,
    });
    if (error) {
      await removePrivateFile(stored.path);
      throw error;
    }
    saved.push(stored.fileName);
  }
  return saved;
}

export async function listDocuments(entityType: EntityType, entityId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("id, file_name, size_bytes, created_at, category, uploaded_by")
    .eq("entity_type", entityType).eq("entity_id", entityId).order("created_at");
  return data ?? [];
}

export function filesFrom(fd: FormData, name = "files") {
  return fd.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);
}
