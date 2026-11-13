import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { mediaUrl } from "@/lib/media";
import { formatDate } from "@/lib/format";
import type { EventItem, NewsItem } from "@/lib/data/public";
import { GeoPattern } from "./brand";

export function NewsCard({ item }: { item: NewsItem }) {
  const src = mediaUrl(item.cover_path);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-md border border-line bg-paper">
      <div className="relative aspect-[16/10] overflow-hidden bg-sand">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <GeoPattern className="text-line" id={`news-${item.id}`} />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <time className="text-xs font-medium text-teal" dateTime={item.published_at}>{formatDate(item.published_at)}</time>
        <h3 className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-ink">
          <Link href={`/news/${item.slug}`} className="after:absolute after:inset-0">{item.title}</Link>
        </h3>
        {item.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{item.excerpt}</p>}
      </div>
    </article>
  );
}

export function EventRow({ event }: { event: EventItem }) {
  const d = new Date(event.starts_at);
  const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Asia/Kolkata" }).format(d);
  return (
    <article className="group relative flex gap-5 border-b border-line py-5 last:border-0">
      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-sm border border-line bg-paper">
        <span className="font-display text-2xl font-semibold leading-none text-ink">{day}</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-accent">{month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[17px] font-semibold leading-snug text-ink">
          <Link href={`/events/${event.slug}`} className="after:absolute after:inset-0">{event.title}</Link>
        </h3>
        {event.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{event.summary}</p>}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(d)}</span>
          {event.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.venue}</span>}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
    </article>
  );
}
