import { PageHero, Container } from "@/components/site/section";
import { EventRow } from "@/components/site/cards";
import { getEvents } from "@/lib/data/public";
import { EmptyState } from "@/components/ui/misc";

export const revalidate = 300;
export const metadata = { title: "Events" };

export default async function EventsPage() {
  const [upcoming, past] = await Promise.all([getEvents("upcoming", 50), getEvents("past", 12)]);
  return (
    <>
      <PageHero eyebrow="Campus life" title="Events" description="Seminars, celebrations, lectures and gatherings at the college." />
      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-display text-2xl font-semibold">Upcoming</h2>
          {upcoming.length ? upcoming.map((e) => <EventRow key={e.id} event={e} />) : <EmptyState title="No upcoming events" />}
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl font-semibold text-muted">Recent</h2>
          {past.length ? past.map((e) => <EventRow key={e.id} event={e} />) : <EmptyState title="No past events" />}
        </section>
      </Container>
    </>
  );
}
