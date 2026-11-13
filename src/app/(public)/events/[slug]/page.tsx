import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, MapPin } from "lucide-react";
import { Container, RichText } from "@/components/site/section";
import { getEvent } from "@/lib/data/public";
import { formatDateTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const e = await getEvent((await params).slug);
  return { title: e?.title ?? "Event", description: e?.summary };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const e = await getEvent((await params).slug);
  if (!e) notFound();
  const img = mediaUrl(e.cover_path);
  return (
    <article>
      <Container className="max-w-3xl py-12 sm:py-16">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft className="h-4 w-4" /> Events</Link>
        <h1 className="display-xl mt-8 text-[36px] sm:text-[48px]">{e.title}</h1>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-accent" />{formatDateTime(e.starts_at)}{e.ends_at && ` – ${formatDateTime(e.ends_at)}`}</span>
          {e.venue && <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" />{e.venue}</span>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt="" className="mt-10 w-full rounded-md border border-line" />}
        <RichText text={e.description || e.summary} className="mt-10 text-[17px]" />
      </Container>
    </article>
  );
}
