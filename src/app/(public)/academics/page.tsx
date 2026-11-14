import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero, Container } from "@/components/site/section";
import { getProgrammes } from "@/lib/data/public";

export const revalidate = 300;
export const metadata = { title: "Academics" };

export default async function AcademicsPage() {
  const programmes = await getProgrammes();
  const levels = Array.from(new Set(programmes.map((p) => p.level)));
  return (
    <>
      <PageHero eyebrow="Academics" title="Learning, structured with care." description="Classes, the academic calendar and the people who teach them." />
      <Container className="grid gap-4 py-14 sm:grid-cols-3 sm:py-20">
        {[
          { t: "Subjects & Classes", d: `${programmes.length} classes across ${levels.length || "several"} levels of study`, h: "/programmes" },
          { t: "Academic Calendar", d: "Terms, examinations, holidays and key deadlines", h: "/calendar" },
          { t: "Teacher Directory", d: "Meet our teachers by department", h: "/faculty" },
        ].map((c) => (
          <Link key={c.h} href={c.h} className="group relative flex min-h-48 flex-col justify-between rounded-md border border-line bg-paper p-6 hover:border-line-strong">
            <ArrowUpRight className="h-5 w-5 self-end text-faint group-hover:text-accent" />
            <div>
              <h2 className="font-display text-xl font-semibold">{c.t}</h2>
              <p className="mt-1.5 text-sm text-muted">{c.d}</p>
            </div>
          </Link>
        ))}
      </Container>
    </>
  );
}
