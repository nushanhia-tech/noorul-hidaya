import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero, Container } from "@/components/site/section";
import { getProgrammes } from "@/lib/data/public";
import { EmptyState } from "@/components/ui/misc";

export const revalidate = 300;
export const metadata = { title: "Courses & Programmes" };

const LEVEL_NAMES: Record<string, string> = { UG: "Undergraduate", PG: "Postgraduate", Diploma: "Diploma", Certificate: "Certificate", Doctoral: "Doctoral" };

export default async function ProgrammesPage() {
  const programmes = await getProgrammes();
  const levels = Array.from(new Set(programmes.map((p) => p.level)));
  return (
    <>
      <PageHero eyebrow="Courses & programmes" title="Programmes of study" description="Structured, semester-based programmes taught by the college's departments." />
      <Container className="py-14 sm:py-20">
        {programmes.length === 0 && <EmptyState title="No programmes published yet" />}
        {levels.map((level) => (
          <section key={level} className="mb-14 last:mb-0">
            <h2 className="mb-5 font-display text-2xl font-semibold">{LEVEL_NAMES[level] ?? level} programmes</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {programmes.filter((p) => p.level === level).map((p) => (
                <Link key={p.id} href={`/programmes/${p.slug}`} className="group rounded-md border border-line bg-paper p-6 hover:border-line-strong">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{p.code}</p>
                      <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">{p.name}</h3>
                      <p className="mt-1 text-sm text-muted">{p.departments?.name}</p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-faint group-hover:text-accent" />
                  </div>
                  {p.summary && <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-ink-soft">{p.summary}</p>}
                  <p className="mt-5 flex gap-4 border-t border-line pt-4 text-[13px] text-muted">
                    <span>{p.duration_semesters} semesters</span>
                    {p.intake ? <span>Intake {p.intake}</span> : null}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </Container>
    </>
  );
}
