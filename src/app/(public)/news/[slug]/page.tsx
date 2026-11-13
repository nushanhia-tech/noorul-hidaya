import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Container, RichText } from "@/components/site/section";
import { getNewsItem } from "@/lib/data/public";
import { formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const n = await getNewsItem((await params).slug);
  return { title: n?.title ?? "News", description: n?.excerpt };
}

export default async function NewsArticle({ params }: { params: Promise<{ slug: string }> }) {
  const n = await getNewsItem((await params).slug);
  if (!n) notFound();
  const img = mediaUrl(n.cover_path);
  return (
    <article>
      <Container className="max-w-3xl py-12 sm:py-16">
        <Link href="/news" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft className="h-4 w-4" /> News</Link>
        <time className="mt-8 block text-sm font-medium text-teal" dateTime={n.published_at}>{formatDate(n.published_at)}</time>
        <h1 className="display-xl mt-3 text-[36px] sm:text-[48px]">{n.title}</h1>
        {n.excerpt && <p className="mt-5 text-lg leading-relaxed text-muted">{n.excerpt}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt="" className="mt-10 w-full rounded-md border border-line" />}
        <RichText text={n.body} className="mt-10 text-[17px]" />
      </Container>
    </article>
  );
}
