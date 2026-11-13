import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, Notice } from "@/components/ui/misc";
import { RichText } from "@/components/site/section";
import { mediaUrl } from "@/lib/media";

export const metadata = { title: "Preview" };

/** Draft preview for editors (reads through RLS: only cms.manage can see drafts). */
export default async function Preview({ params }: { params: Promise<{ type: string; id: string }> }) {
  await requirePortal("admin");
  const { type, id } = await params;
  const db = await createClient();
  const { data } = type === "page"
    ? await db.from("site_pages").select("title, summary, body, image_path, status").eq("slug", id).maybeSingle()
    : await db.from("news").select("title, summary:excerpt, body, image_path:cover_path, status").eq("id", id).maybeSingle();
  if (!data) notFound();
  const img = mediaUrl(data.image_path);
  return (
    <>
      <PageHeader title="Preview" back={{ href: `/portal/admin/website?tab=${type === "page" ? "pages" : "news"}`, label: "Website content" }} />
      {data.status !== "published" && <Notice tone="warning" className="mb-6">Draft — not visible on the public website.</Notice>}
      <article className="max-w-3xl rounded-md border border-line bg-paper p-6 sm:p-10">
        <h1 className="display-xl text-[40px]">{data.title}</h1>
        {data.summary && <p className="mt-4 text-lg text-muted">{data.summary}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt="" className="mt-8 w-full rounded-md" />}
        <RichText text={data.body ?? ""} className="mt-8 text-[17px]" />
      </article>
    </>
  );
}
