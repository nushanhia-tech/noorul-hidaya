import { FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { lookups, facultyOptions } from "@/lib/data/lookups";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { NewOfferingForm } from "./forms";

export const metadata = { title: "Offerings & Timetable" };

export default async function OfferingsPage({ searchParams }: { searchParams: Promise<{ term?: string; batch?: string }> }) {
  await requirePortal("admin");
  const sp = await searchParams;
  const [lk, fac] = await Promise.all([lookups(), facultyOptions()]);
  const term = sp.term ?? lk.terms.find((t) => t.is_current)?.id ?? lk.terms[0]?.id;
  const db = await createClient();
  let q = db.from("course_offerings").select("id, semester_number, courses(code, title), batches(name), offering_faculty(faculty(profiles(full_name))), enrolments(count), timetable_slots(count)");
  if (term) q = q.eq("term_id", term);
  if (sp.batch) q = q.eq("batch_id", sp.batch);
  const { data } = await q;
  const rows = ((data ?? []) as unknown as { id: string; semester_number: number; courses: { code: string; title: string }; batches: { name: string }; offering_faculty: { faculty: { profiles: { full_name: string } } }[]; enrolments: { count: number }[]; timetable_slots: { count: number }[] }[])
    .sort((a, b) => a.batches.name.localeCompare(b.batches.name) || a.courses.code.localeCompare(b.courses.code));
  return (
    <>
      <PageHeader title="Subject offerings & timetable" description="Which subject is taught to which division in a term, by whom, and when." />
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-3">
        <span className="mr-1 text-sm font-medium">Download PDF:</span>
        {[["class", sp.batch ? "Class-wise (selected division)" : "Class-wise"], ["faculty", "Teacher-wise"], ["all", "All classes, subjects & teachers"]].map(([t, label]) => (
          <a key={t} href={`/api/reports/timetable?type=${t}${term ? `&term=${term}` : ""}${t === "class" && sp.batch ? `&batch=${sp.batch}` : ""}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-white px-3 text-sm hover:bg-ivory"><FileDown className="h-4 w-4" /> {label}</a>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <FilterBar className="mb-4" placeholder="—" q={undefined}>
            <FilterSelect name="term" value={term} label="Term" options={lk.terms.map((t) => ({ value: t.id, label: t.name }))} />
            <FilterSelect name="batch" value={sp.batch} label="Division" options={lk.batches.map((b) => ({ value: b.id, label: b.name }))} />
          </FilterBar>
          <Card>
            <DataTable rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/portal/admin/offerings/${r.id}`} empty={<EmptyState title="No offerings for this term" />}
              columns={[
                { key: "c", header: "Subject", primary: true, cell: (r) => <span><span className="tabular mr-2 text-faint">{r.courses.code}</span>{r.courses.title}</span> },
                { key: "b", header: "Division", cell: (r) => r.batches.name },
                { key: "f", header: "Teacher", cell: (r) => r.offering_faculty.map((f) => f.faculty.profiles.full_name).join(", ") || <span className="text-danger">Unassigned</span> },
                { key: "s", header: "Students", align: "right", cell: (r) => r.enrolments[0]?.count ?? 0 },
                { key: "t", header: "Periods/wk", align: "right", cell: (r) => r.timetable_slots[0]?.count ?? 0 },
              ]} />
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader title="New offering" />
          <CardBody>
            <NewOfferingForm defaultTerm={term} faculty={fac}
              courses={lk.courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
              terms={lk.terms.map((t) => ({ value: t.id, label: t.name }))}
              batches={lk.batches.filter((b) => b.is_active).map((b) => ({ value: b.id, label: b.name }))} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
