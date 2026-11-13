import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { formatDate, humanize } from "@/lib/format";

/** Notices visible to the signed-in user; audience filtering is enforced by RLS. */
export async function NoticesPage({ searchParams, description }: { searchParams: Promise<{ q?: string; category?: string }>; description?: string }) {
  const { q, category } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("notices").select("id, title, body, category, is_important, published_at, audience")
    .eq("status", "published").order("is_important", { ascending: false }).order("published_at", { ascending: false }).limit(100);
  if (category) query = query.eq("category", category);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const today = new Date().toISOString().slice(0, 10);
  const notices = (data ?? []);
  return (
    <>
      <PageHeader title="Notices" description={description ?? "Circulars and announcements from the college."} />
      <FilterBar q={q} placeholder="Search notices" className="mb-5">
        <FilterSelect name="category" value={category} label="Category" options={["general","academic","examination","administrative","fee","event"].map((c) => ({ value: c, label: humanize(c) }))} />
      </FilterBar>
      <Card>
        {notices.length === 0 ? <EmptyState icon={Megaphone} title="No notices" /> : (
          <ul className="divide-y divide-line">
            {notices.map((n) => (
              <li key={n.id} className="px-5 py-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
                  <span>{formatDate(n.published_at)}</span>
                  <Badge>{humanize(n.category)}</Badge>
                  {n.is_important && <Badge tone="accent">Important</Badge>}
                </div>
                <h2 className="mt-2 font-medium text-ink">{n.title}</h2>
                {n.body && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{n.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-faint">Showing notices current as of {formatDate(today)}.</p>
    </>
  );
}
