import { publicEnv } from "@/lib/env";

/** Public URL for an image in the public-media bucket (or an absolute/static path). */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("/") || path.startsWith("http")) return path;
  if (!publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/public-media/${path}`;
}
