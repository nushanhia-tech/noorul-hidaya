import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero, Container, RichText } from "@/components/site/section";
import { getDepartment } from "@/lib/data/public";
import { Avatar } from "@/components/ui/misc";
import { mediaUrl } from "@/lib/media";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getDepartment((await params).slug);
  return { title: data?.department.name ?? "Department" };
}

export default async function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getDepartment((await params).slug);
  if (!data) notFound();
  const { department: d, programmes, faculty } = data;
  return (
    <>
      <PageHero eyebrow={`Department · ${d.code}`} title={d.name} description={d.summary} />
      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {d.description ? <RichText text={d.description} className="text-[16.5px]" /> : <p className="text-muted">No description yet.</p>}
          <h2 className="mt-14 font-display text-2xl font-semibold">Faculty</h2>
          {faculty.length === 0 ? <p className="mt-3 text-sm text-muted">Faculty profiles will appear here.</p> : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {faculty.map((f) => (
                <li key={f.id} className="flex gap-4 rounded-md border border-line bg-paper p-4">
                  <Avatar name={f.full_name} src={mediaUrl(f.photo_path)} size={48} />
                  <div className="min-w-0">
                    <p className="font-medium">{f.full_name}</p>
                    <p className="text-sm text-muted">{f.designation}{f.is_hod && " · Head of Department"}</p>
                    {f.specialization && <p className="mt-1 text-xs text-faint">{f.specialization}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="h-fit rounded-md border border-line bg-paper lg:sticky lg:top-32">
          <h2 className="border-b border-line px-5 py-4 text-sm font-semibold">Programmes offered</h2>
          {programmes.length === 0 ? <p className="px-5 py-4 text-sm text-muted">None listed.</p> : (
            <ul className="divide-y divide-line">
              {programmes.map((p) => (
                <li key={p.id}>
                  <Link href={`/programmes/${p.slug}`} className="block px-5 py-3.5 hover:bg-white">
                    <span className="text-xs font-semibold text-accent">{p.level}</span>
                    <span className="block font-medium">{p.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </Container>
    </>
  );
}
