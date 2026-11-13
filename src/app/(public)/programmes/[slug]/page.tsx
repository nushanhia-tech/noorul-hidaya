import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero, Container, RichText } from "@/components/site/section";
import { getProgramme } from "@/lib/data/public";
import { KeyValue } from "@/components/ui/misc";
import { humanize } from "@/lib/format";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getProgramme((await params).slug);
  return { title: data?.programme.name ?? "Programme" };
}

export default async function ProgrammePage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getProgramme((await params).slug);
  if (!data) notFound();
  const { programme: p, courses } = data;
  const semesters = Array.from(new Set(courses.map((c) => c.semester_number ?? 0))).sort((a, b) => a - b);
  return (
    <>
      <PageHero eyebrow={`${p.level} programme · ${p.code}`} title={p.name} description={p.summary}>
        {p.departments && <p className="mt-4 text-sm">Offered by <Link className="font-medium underline underline-offset-4" href={`/departments/${p.departments.slug}`}>{p.departments.name}</Link></p>}
      </PageHero>
      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {p.description && <RichText text={p.description} className="text-[16.5px]" />}
          {courses.length > 0 && (
            <>
              <h2 className="mt-12 font-display text-2xl font-semibold">Course structure</h2>
              <div className="mt-5 space-y-6">
                {semesters.map((s) => (
                  <div key={s} className="overflow-hidden rounded-md border border-line bg-paper">
                    <p className="border-b border-line bg-ivory px-5 py-2.5 text-sm font-semibold">{s ? `Semester ${s}` : "Across semesters"}</p>
                    <ul className="divide-y divide-line">
                      {courses.filter((c) => (c.semester_number ?? 0) === s).map((c) => (
                        <li key={c.code} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                          <span><span className="tabular mr-3 text-faint">{c.code}</span>{c.title}</span>
                          <span className="shrink-0 text-muted">{humanize(c.course_type)} · {c.credits} cr</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <aside className="h-fit space-y-6 rounded-md border border-line bg-paper p-6 lg:sticky lg:top-32">
          <KeyValue columns={1} items={[
            { label: "Level", value: p.level },
            { label: "Duration", value: `${p.duration_semesters} semesters` },
            { label: "Intake", value: p.intake ?? "—" },
            { label: "Eligibility", value: p.eligibility || "—" },
          ]} />
        </aside>
      </Container>
    </>
  );
}
