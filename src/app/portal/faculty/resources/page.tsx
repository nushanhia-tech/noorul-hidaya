import { FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty, getMyOfferings, offeringLabel } from "@/lib/data/faculty";
import { PageHeader, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { formatDate, humanize } from "@/lib/format";
import { formatBytes } from "@/lib/uploads";
import { UploadForm, ResourceRow } from "./forms";

export const metadata = { title: "Teaching Resources" };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ offering?: string; q?: string }> }) {
  const { offering, q } = await searchParams;
  const { faculty } = await getMyFaculty();
  const offerings = await getMyOfferings(faculty.id, false);
  const ids = offerings.filter((o) => !offering || o.id === offering).map((o) => o.id);
  const supabase = await createClient();
  let query = supabase.from("study_resources").select("id, title, description, resource_kind, file_name, size_bytes, is_published, created_at, offering_id").order("created_at", { ascending: false });
  query = ids.length ? query.in("offering_id", ids) : query.eq("offering_id", "00000000-0000-0000-0000-000000000000");
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const oMap = new Map(offerings.map((o) => [o.id, o]));
  const options = offerings.map((o) => ({ value: o.id, label: `${offeringLabel(o)} — ${o.batches?.name}${o.terms?.is_current ? "" : ` (${o.terms?.name})`}` }));
  return (
    <>
      <PageHeader title="Teaching resources" description="Share notes, slides and references with students enrolled in your courses." />
      <Notice tone="info" className="mb-6">This is a resource library, not an assignment system — students can download files but do not submit work here.</Notice>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <FilterBar q={q} placeholder="Search resources" className="mb-4">
            <FilterSelect name="offering" value={offering} label="Course" options={options} />
          </FilterBar>
          <Card>
            {(data ?? []).length === 0 ? <EmptyState icon={FolderOpen} title="No resources yet" description="Upload your first file using the form." /> : (
              <ul className="divide-y divide-line">
                {(data ?? []).map((r) => (
                  <ResourceRow key={r.id} resource={r} meta={
                    <>
                      <Badge>{humanize(r.resource_kind)}</Badge>{!r.is_published && <Badge tone="warning">Hidden from students</Badge>}
                      <span className="text-xs text-faint">{oMap.get(r.offering_id)?.courses?.code} · {r.file_name} · {formatBytes(r.size_bytes)} · {formatDate(r.created_at)}</span>
                    </>
                  } />
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader title="Upload a resource" description="PDF, DOCX or images · up to 10 MB" />
          <CardBody>{options.length ? <UploadForm options={options} defaultOffering={offering} /> : <p className="text-sm text-muted">You have no assigned courses.</p>}</CardBody>
        </Card>
      </div>
    </>
  );
}
