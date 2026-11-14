import { BookOpen, Download, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getEnrolledOfferings } from "@/lib/data/student";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { formatDate, humanize } from "@/lib/format";
import { formatBytes } from "@/lib/uploads";

export const metadata = { title: "Study Materials" };

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ q?: string; course?: string; kind?: string }> }) {
  const { q, course, kind } = await searchParams;
  const { student } = await getMyStudent();
  const offerings = await getEnrolledOfferings(student.id, false);
  const ids = offerings.map((o) => o.id);
  const supabase = await createClient();
  let rows: { id: string; title: string; description: string; resource_kind: string; file_name: string; size_bytes: number; created_at: string; offering_id: string; uploader: { full_name: string } | null }[] = [];
  if (ids.length) {
    let query = supabase.from("study_resources")
      .select("id, title, description, resource_kind, file_name, size_bytes, created_at, offering_id, uploader:profiles!study_resources_uploaded_by_fkey(full_name)")
      .in("offering_id", course && ids.includes(course) ? [course] : ids).eq("is_published", true).order("created_at", { ascending: false });
    if (kind) query = query.eq("resource_kind", kind);
    if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
    rows = ((await query).data ?? []) as unknown as typeof rows;
  }
  const byId = new Map(offerings.map((o) => [o.id, o]));
  return (
    <>
      <PageHeader title="Study materials" description="Notes, slides and references shared by your teachers." />
      <FilterBar q={q} placeholder="Search materials" className="mb-5">
        <FilterSelect name="course" value={course} label="Subject" options={offerings.map((o) => ({ value: o.id, label: `${o.courses?.code} — ${o.courses?.title}` }))} />
        <FilterSelect name="kind" value={kind} label="Type" options={["notes","slides","reading","syllabus","question_bank","reference","other"].map((k) => ({ value: k, label: humanize(k) }))} />
      </FilterBar>
      <Card>
        {rows.length === 0 ? <EmptyState icon={BookOpen} title="No materials found" description={q || course || kind ? "Try clearing the filters." : "Your teachers have not shared materials yet."} /> : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-teal-50 text-teal sm:flex"><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.title} <Badge className="ml-1">{humanize(r.resource_kind)}</Badge></p>
                  {r.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{r.description}</p>}
                  <p className="mt-1 text-xs text-faint">{byId.get(r.offering_id)?.courses?.code} · {r.uploader?.full_name} · {formatDate(r.created_at)} · {formatBytes(r.size_bytes)}</p>
                </div>
                <a href={`/api/resources/${r.id}`} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-line-strong bg-white px-3 text-sm hover:bg-ivory"><Download className="h-4 w-4" /> Download</a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
