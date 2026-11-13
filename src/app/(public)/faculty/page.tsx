import Link from "next/link";
import { PageHero, Container } from "@/components/site/section";
import { getDepartments, getFacultyDirectory } from "@/lib/data/public";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { mediaUrl } from "@/lib/media";

export const metadata = { title: "Faculty Directory" };

export default async function FacultyDirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string; department?: string }> }) {
  const { q, department } = await searchParams;
  const [faculty, departments] = await Promise.all([getFacultyDirectory(department, q), getDepartments()]);
  const grouped = new Map<string, typeof faculty>();
  for (const f of faculty) grouped.set(f.department_name, [...(grouped.get(f.department_name) ?? []), f]);
  return (
    <>
      <PageHero eyebrow="Faculty" title="Faculty directory" description="Teachers and scholars across our departments." />
      <Container className="py-12 sm:py-16">
        <FilterBar q={q} placeholder="Search by name">
          <FilterSelect name="department" value={department} label="Department" options={departments.map((d) => ({ value: d.slug, label: d.name }))} />
        </FilterBar>
        {faculty.length === 0 ? <EmptyState className="mt-8" title="No faculty found" description="Try a different name or department." /> : (
          <div className="mt-10 space-y-12">
            {[...grouped.entries()].map(([dept, members]) => (
              <section key={dept}>
                <h2 className="mb-4 flex items-baseline justify-between border-b border-line pb-3 font-display text-xl font-semibold">
                  {members[0].department_slug ? <Link href={`/departments/${members[0].department_slug}`} className="hover:underline">{dept}</Link> : dept}
                  <span className="text-sm font-normal text-muted">{members.length}</span>
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((f) => (
                    <li key={f.id} className="flex gap-4 rounded-md border border-line bg-paper p-4">
                      <Avatar name={f.full_name} src={mediaUrl(f.photo_path)} size={52} />
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{f.full_name}</p>
                        <p className="text-sm text-muted">{f.designation}{f.is_hod && " · HoD"}</p>
                        {f.qualification && <p className="mt-1 text-xs text-faint">{f.qualification}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
