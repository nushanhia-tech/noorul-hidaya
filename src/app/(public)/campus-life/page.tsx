import { PageHero, Section } from "@/components/site/section";
import { EventRow } from "@/components/site/cards";
import { getEvents, getGallery } from "@/lib/data/public";
import { mediaUrl } from "@/lib/media";
import { EmptyState } from "@/components/ui/misc";

export const revalidate = 300;
export const metadata = { title: "Campus Life" };

export default async function CampusLifePage() {
  const [events, gallery] = await Promise.all([getEvents("upcoming", 6), getGallery(12)]);
  return (
    <>
      <PageHero eyebrow="Campus life" title="Beyond the classroom." description="Events, gatherings and everyday moments from the college." />
      <Section title="Upcoming events" link={{ href: "/events", label: "All events" }}>
        {events.length ? <div className="grid gap-x-12 md:grid-cols-2">{events.map((e) => <EventRow key={e.id} event={e} />)}</div>
          : <EmptyState title="No upcoming events" description="New events will appear here once published." />}
      </Section>
      <Section tone="paper" title="Gallery" link={{ href: "/gallery", label: "Open gallery" }}>
        {gallery.length ? (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {gallery.map((g) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={g.id} src={mediaUrl(g.image_path)!} alt={g.title} loading="lazy" className="aspect-square w-full rounded-sm object-cover" />
            ))}
          </div>
        ) : <EmptyState title="No photographs yet" />}
      </Section>
    </>
  );
}
