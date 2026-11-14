import { PageHero, Container } from "@/components/site/section";
import { NewsCard } from "@/components/site/cards";
import { getNews, getPublicNotices } from "@/lib/data/public";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/format";

export const metadata = { title: "News & Announcements" };
const PAGE = 9;

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [{ items, total }, notices] = await Promise.all([getNews(PAGE, (page - 1) * PAGE), getPublicNotices(30)]);
  return (
    <>
      <PageHero eyebrow="News & notices" title="News and announcements" description="Stories from the campus and official notices from the school office." />
      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="news-h">
          <h2 id="news-h" className="mb-5 font-display text-2xl font-semibold">Latest news</h2>
          {items.length === 0 ? <EmptyState title="No news yet" /> : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">{items.map((n) => <NewsCard key={n.id} item={n} />)}</div>
              <div className="mt-6 rounded-md border border-line"><Pagination page={page} pageSize={PAGE} total={total} hrefFor={(p) => `/news?page=${p}`} /></div>
            </>
          )}
        </section>
        <section id="notices" aria-labelledby="notices-h" className="scroll-mt-32">
          <h2 id="notices-h" className="mb-5 font-display text-2xl font-semibold">Notices</h2>
          {notices.length === 0 ? <EmptyState title="No public notices" /> : (
            <ul className="divide-y divide-line rounded-md border border-line bg-paper">
              {notices.map((n) => (
                <li key={n.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 text-xs text-faint">
                    {formatDate(n.published_at)} {n.is_important && <Badge tone="accent">Important</Badge>} <Badge>{humanize(n.category)}</Badge>
                  </div>
                  <p className="mt-1.5 font-medium">{n.title}</p>
                  {n.body && <p className="mt-1 whitespace-pre-line text-sm text-muted">{n.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </>
  );
}
