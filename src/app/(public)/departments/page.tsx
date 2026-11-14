import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero, Container } from "@/components/site/section";
import { getDepartments } from "@/lib/data/public";
import { EmptyState } from "@/components/ui/misc";
import { mediaUrl } from "@/lib/media";

export const revalidate = 300;
export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const departments = await getDepartments();
  return (
    <>
      <PageHero eyebrow="Departments" title="Our academic departments" description="Each department is home to its own teacher, classes and scholarly community." />
      <Container className="py-14 sm:py-20">
        {departments.length === 0 ? <EmptyState title="No departments published yet" /> : (
          <div className="grid gap-5 md:grid-cols-2">
            {departments.map((d) => {
              const img = mediaUrl(d.image_path);
              return (
                <Link key={d.id} href={`/departments/${d.slug}`} className="group flex overflow-hidden rounded-md border border-line bg-paper hover:border-line-strong">
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="hidden w-40 object-cover sm:block" loading="lazy" />
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs font-semibold tracking-wider text-accent">{d.code}</span>
                      <ArrowUpRight className="h-5 w-5 text-faint group-hover:text-accent" />
                    </div>
                    <h2 className="mt-3 font-display text-xl font-semibold tracking-tight">{d.name}</h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{d.summary}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}
