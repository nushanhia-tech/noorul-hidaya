import Link from "next/link";
import { Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { EditRow } from "../academic-forms";
import { ContentForm, PageForm } from "./forms";
import type { CmsType } from "./actions";

export const metadata = { title: "Website Content" };

const TABS: { key: string; label: string; type?: CmsType; table?: string; order?: string; title: (r: Record<string, unknown>) => string; sub?: (r: Record<string, unknown>) => string }[] = [
  { key: "hero", label: "Hero", type: "hero", table: "hero_slides", order: "sort_order", title: (r) => r.title as string, sub: (r) => (r.image_path ? "Photo uploaded" : "No photo — illustration shown") },
  { key: "pages", label: "Pages", title: () => "" },
  { key: "news", label: "News", type: "news", table: "news", order: "created_at", title: (r) => r.title as string, sub: (r) => (r.published_at ? formatDateTime(r.published_at as string) : "Not published") },
  { key: "events", label: "Events", type: "event", table: "events", order: "starts_at", title: (r) => r.title as string, sub: (r) => formatDateTime(r.starts_at as string) },
  { key: "gallery", label: "Gallery", type: "gallery", table: "gallery_items", order: "sort_order", title: (r) => r.title as string, sub: (r) => r.album as string },
  { key: "achievements", label: "Achievements", type: "achievement", table: "achievements", order: "sort_order", title: (r) => `${r.figure} — ${r.label}` },
  { key: "leadership", label: "Leadership", type: "leader", table: "leadership", order: "sort_order", title: (r) => r.name as string, sub: (r) => r.designation as string },
  { key: "calendar", label: "Calendar", type: "calendar", table: "calendar_entries", order: "starts_on", title: (r) => r.title as string, sub: (r) => formatDate(r.starts_on as string) },
];
const PAGES = [{ slug: "about", label: "About the College" }, { slug: "mission-vision", label: "Mission & Vision" }, { slug: "administration", label: "Administration" }];

export default async function WebsiteAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePortal("admin");
  const { tab = "hero" } = await searchParams;
  const def = TABS.find((t) => t.key === tab) ?? TABS[0];
  const db = await createClient();
  const tabs = <Tabs active={`/portal/admin/website?tab=${def.key}`} items={TABS.map((t) => ({ href: `/portal/admin/website?tab=${t.key}`, label: t.label }))} />;
  const header = <PageHeader title="Website content" description="Everything on the public website is managed here. Drafts stay hidden until published." actions={<Link href="/" target="_blank" className="text-sm font-medium text-royal hover:underline">View website ↗</Link>} />;

  if (def.key === "pages") {
    const { data } = await db.from("site_pages").select("*");
    const by = new Map((data ?? []).map((p) => [p.slug, p]));
    return (
      <>{header}{tabs}
        <Card>
          {PAGES.map((p) => {
            const row = by.get(p.slug);
            return (
              <EditRow key={p.slug} summary={<span className="flex flex-wrap items-center gap-3"><span className="font-medium">{p.label}</span><StatusBadge status={row?.status ?? "draft"} label={row ? undefined : "Not written"} />
                {row && <Link href={`/portal/admin/website/preview/page/${p.slug}`} className="relative z-10 inline-flex items-center gap-1 text-xs text-royal hover:underline"><Eye className="h-3.5 w-3.5" /> Preview</Link>}</span>}>
                <PageForm slug={p.slug} d={row ?? undefined} />
              </EditRow>
            );
          })}
        </Card>
      </>
    );
  }
  const { data } = await db.from(def.table!).select("*").order(def.order!, { ascending: def.key === "calendar" || def.order === "sort_order" });
  const rows = (data ?? []) as Record<string, unknown>[];
  return (
    <>{header}{tabs}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          {rows.length === 0 ? <EmptyState title={`No ${def.label.toLowerCase()} yet`} /> : rows.map((r) => {
            const img = mediaUrl((r.image_path ?? r.cover_path ?? r.photo_path) as string | null);
            return (
              <EditRow key={r.id as string} summary={
                <span className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {img && <img src={img} alt="" className="h-10 w-14 shrink-0 rounded-xs object-cover" />}
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{def.title(r)}</span>{def.sub && <span className="text-xs text-muted">{def.sub(r)}</span>}</span>
                  {"status" in r && <StatusBadge status={r.status as string} />}
                  {def.key === "news" && <Link href={`/portal/admin/website/preview/news/${r.id}`} className="relative z-10 text-xs text-royal hover:underline">Preview</Link>}
                </span>
              }>
                <ContentForm type={def.type!} d={r} id={r.id as string} />
              </EditRow>
            );
          })}
        </Card>
        <Card className="h-fit"><CardHeader title={`Add ${def.label.toLowerCase().replace(/s$/, "")}`} /><CardBody><ContentForm type={def.type!} /></CardBody></Card>
      </div>
    </>
  );
}
