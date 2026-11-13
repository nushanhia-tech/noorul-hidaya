import { PageHero, Container } from "@/components/site/section";
import { getCalendar } from "@/lib/data/public";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/format";

export const revalidate = 300;
export const metadata = { title: "Academic Calendar" };

const TONES = { term: "royal", examination: "accent", holiday: "teal", event: "plum", deadline: "danger", result: "success" } as const;

export default async function CalendarPage() {
  const entries = await getCalendar();
  const months = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = e.starts_on.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), e]);
  }
  return (
    <>
      <PageHero eyebrow="Academics" title="Academic calendar" description="Terms, examinations, holidays and important deadlines for the academic year." />
      <Container className="py-14 sm:py-20">
        {entries.length === 0 ? <EmptyState title="The calendar has not been published yet" /> : (
          <div className="space-y-10">
            {[...months.entries()].map(([month, items]) => (
              <section key={month} className="grid gap-4 md:grid-cols-[200px_1fr]">
                <h2 className="font-display text-xl font-semibold md:sticky md:top-32 md:h-fit">{formatDate(month + "-01", { month: "long", year: "numeric", day: undefined })}</h2>
                <ol className="divide-y divide-line rounded-md border border-line bg-paper">
                  {items.map((e) => (
                    <li key={e.id} className="flex flex-col gap-1.5 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
                      <span className="tabular w-40 shrink-0 text-sm font-medium text-ink">
                        {formatDate(e.starts_on, { day: "numeric", month: "short" })}
                        {e.ends_on && e.ends_on !== e.starts_on && ` – ${formatDate(e.ends_on, { day: "numeric", month: "short" })}`}
                      </span>
                      <span className="flex-1">
                        <span className="font-medium">{e.title}</span>
                        {e.description && <span className="block text-sm text-muted">{e.description}</span>}
                      </span>
                      <Badge tone={TONES[e.category as keyof typeof TONES] ?? "neutral"}>{humanize(e.category)}</Badge>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
