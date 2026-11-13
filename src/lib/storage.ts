import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUpload, IMAGE_TYPES, MAX_IMAGE_BYTES, type AllowedMime } from "@/lib/uploads";

export const PRIVATE_BUCKET = "documents";
export const PUBLIC_BUCKET = "public-media";

export type StoredFile = { path: string; fileName: string; mime: AllowedMime; size: number };

/**
 * Validate and store a file in the PRIVATE bucket. Call only after the caller's
 * access to the owning record has been verified; the metadata row is then
 * inserted with the user's client so RLS checks it again.
 */
export async function storePrivateFile(file: File, folder: string): Promise<StoredFile> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(file, buffer.subarray(0, 4096));
  if (!check.ok) throw new UploadError(check.error);
  const path = `${folder}/${randomUUID()}-${check.safeName}`;
  const { error } = await createAdminClient().storage.from(PRIVATE_BUCKET).upload(path, buffer, {
    contentType: check.mime, upsert: false,
  });
  if (error) throw new UploadError("Upload failed. Please try again.");
  return { path, fileName: check.safeName, mime: check.mime, size: file.size };
}

export async function removePrivateFile(path: string) {
  await createAdminClient().storage.from(PRIVATE_BUCKET).remove([path]);
}

/** Short-lived signed URL for a private object (caller must have verified access). */
export async function signedUrl(path: string, downloadName?: string) {
  const { data, error } = await createAdminClient().storage.from(PRIVATE_BUCKET).createSignedUrl(path, 60, {
    download: downloadName ?? true,
  });
  if (error || !data) throw new Error("Could not create download link");
  return data.signedUrl;
}

/** Website images go to the public bucket (uploaded with the editor's own session; storage RLS checks cms.manage). */
export async function storePublicImage(file: File, folder: string, client: { storage: ReturnType<typeof createAdminClient>["storage"] }) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(file, buffer.subarray(0, 64), { allowed: IMAGE_TYPES, maxBytes: MAX_IMAGE_BYTES });
  if (!check.ok) throw new UploadError(check.error);
  const path = `${folder}/${randomUUID()}.${check.ext}`;
  const { error } = await client.storage.from(PUBLIC_BUCKET).upload(path, buffer, { contentType: check.mime, upsert: false });
  if (error) throw new UploadError("Image upload failed: " + error.message);
  return path;
}

export class UploadError extends Error {}
