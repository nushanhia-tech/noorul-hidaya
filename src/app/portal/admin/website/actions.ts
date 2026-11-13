"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { storePublicImage, UploadError } from "@/lib/storage";
import { slugify } from "@/lib/format";
import { toActionError, must, type ActionResult } from "@/lib/actions";

const s = (max = 300) => z.string().trim().max(max);
const status = z.enum(["draft", "published"]);
const bool = z.string().optional().transform((v) => v === "on");
const num = z.coerce.number().int().min(0).max(9999).default(0);

const TYPES = {
  hero: { table: "hero_slides", image: "image_path", schema: z.object({ eyebrow: s(120), title: s(160).min(2), subtitle: s(400), image_alt: s(200), sort_order: num, status }) },
  news: {
    table: "news", image: "cover_path",
    schema: z.object({ title: s(200).min(4, "Title is too short"), slug: s(80).optional(), excerpt: s(400), body: s(20000), status, published_at: z.string().optional() })
      .transform((d) => ({ ...d, slug: slugify(d.slug || d.title), published_at: d.status === "published" ? (d.published_at ? new Date(d.published_at).toISOString() : new Date().toISOString()) : null })),
  },
  event: {
    table: "events", image: "cover_path",
    schema: z.object({ title: s(200).min(3), slug: s(80).optional(), summary: s(400), description: s(10000), venue: s(160), starts_at: z.string().min(1, "Start is required"), ends_at: z.string().optional(), status })
      .transform((d) => ({ ...d, slug: slugify(d.slug || d.title), starts_at: new Date(d.starts_at).toISOString(), ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null })),
  },
  gallery: { table: "gallery_items", image: "image_path", schema: z.object({ title: s(160).min(2), caption: s(300), album: s(80).min(1).default("Campus"), sort_order: num, status }) },
  achievement: { table: "achievements", image: null, schema: z.object({ figure: s(20).min(1), label: s(120).min(2), description: s(300), sort_order: num, is_published: bool }) },
  leader: { table: "leadership", image: "photo_path", schema: z.object({ name: s(120).min(2), designation: s(120).min(2), message: s(3000), sort_order: num, is_published: bool }) },
  calendar: {
    table: "calendar_entries", image: null,
    schema: z.object({ title: s(200).min(2), description: s(500), category: z.enum(["term", "examination", "holiday", "event", "deadline", "result"]), starts_on: z.string().min(1), ends_on: z.string().optional(), is_public: bool })
      .transform((d) => ({ ...d, ends_on: d.ends_on || null })),
  },
} as const;
export type CmsType = keyof typeof TYPES;

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveContent(type: CmsType, id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("cms.manage");
    const def = TYPES[type];
    const data = def.schema.parse(Object.fromEntries(fd)) as Record<string, unknown>;
    const db = await createClient();
    const file = fd.get("image");
    if (def.image && file instanceof File && file.size > 0) data[def.image] = await storePublicImage(file, type, db);
    if (type === "gallery" && !id && !data.image_path) return { ok: false, error: "Choose a photograph to upload.", fieldErrors: { image: "Required" } };
    if (id) must(await db.from(def.table).update(data).eq("id", id));
    else must(await db.from(def.table).insert(data));
    refresh();
    revalidatePath("/portal/admin/website");
    return { ok: true, message: id ? "Saved." : "Added." };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function deleteContent(type: CmsType, id: string): Promise<ActionResult> {
  try {
    await assertPermission("cms.manage");
    const db = await createClient();
    must(await db.from(TYPES[type].table).delete().eq("id", id));
    refresh();
    revalidatePath("/portal/admin/website");
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function savePage(slug: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("cms.manage");
    const d = z.object({ title: s(160).min(2), summary: s(1000), body: s(30000), status }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const row: Record<string, unknown> = { slug, ...d, updated_by: me.id };
    const file = fd.get("image");
    if (file instanceof File && file.size > 0) row.image_path = await storePublicImage(file, "pages", db);
    must(await db.from("site_pages").upsert(row, { onConflict: "slug" }));
    refresh();
    return { ok: true, message: d.status === "published" ? "Page published." : "Draft saved (not visible on the website)." };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}

export async function setContactStatus(id: string, status: "read" | "replied" | "archived") {
  await assertPermission("cms.manage");
  const db = await createClient();
  await db.from("contact_messages").update({ status }).eq("id", id);
  revalidatePath("/portal/admin/messages");
}
