import Link from "next/link";
import { PageHero, Container } from "@/components/site/section";
import { createPublicClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/misc";
import { FilterBar } from "@/components/ui/search";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const term = q.replace(/[%_,()]/g, " ");
  const db = createPublicClient();
  let results: { group: string; items: { title: string; href: string; sub?: string }[] }[] = [];
  if (q && db) {
    const like = `%${term}%`;
    const [d, p, n, e] = await Promise.all([
      db.from("departments").select("name, slug, summary").or(`name.ilike.${like},summary.ilike.${like}`).limit(10),
      db.from("programmes").select("name, slug, level").or(`name.ilike.${like},summary.ilike.${like}`).limit(10),
      db.from("news").select("title, slug, excerpt").or(`title.ilike.${like},excerpt.ilike.${like}`).limit(10),
      db.from("events").select("title, slug, summary").or(`title.ilike.${like},summary.ilike.${like}`).limit(10),
    ]);
    results = [
      { group: "Departments", items: (d.data ?? []).map((x) => ({ title: x.name, href: `/departments/${x.slug}`, sub: x.summary })) },
      { group: "Classes", items: (p.data ?? []).map((x) => ({ title: x.name, href: `/programmes/${x.slug}`, sub: x.level })) },
      { group: "News", items: (n.data ?? []).map((x) => ({ title: x.title, href: `/news/${x.slug}`, sub: x.excerpt })) },
      { group: "Events", items: (e.data ?? []).map((x) => ({ title: x.title, href: `/events/${x.slug}`, sub: x.summary })) },
    ].filter((g) => g.items.length);
  }
  return (
    <>
      <PageHero eyebrow="Search" title={q ? `Results for “${q}”` : "Search the website"} />
      <Container className="max-w-3xl py-12">
        <FilterBar q={q} placeholder="Search classes, departments, news…" />
        <div className="mt-10 space-y-10">
          {q && results.length === 0 && <EmptyState title="Nothing found" description="Try a shorter or different search term." />}
          {results.map((g) => (
            <section key={g.group}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">{g.group}</h2>
              <ul className="divide-y divide-line rounded-md border border-line bg-paper">
                {g.items.map((i) => (
                  <li key={i.href}><Link href={i.href} className="block px-5 py-3.5 hover:bg-white"><span className="font-medium">{i.title}</span>{i.sub && <span className="block truncate text-sm text-muted">{i.sub}</span>}</Link></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
