import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { lookups } from "@/lib/data/lookups";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { CourseForm, EditRow, ProgrammeForm } from "../academic-forms";

export const metadata = { title: "Programmes & Courses" };

export default async function ProgrammesAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; programme?: string }> }) {
  await requirePortal("admin");
  const { tab = "programmes", q, programme } = await searchParams;
  const lk = await lookups();
  const db = await createClient();
  const tabs = <Tabs active={`/portal/admin/programmes${tab === "courses" ? "?tab=courses" : ""}`} items={[{ href: "/portal/admin/programmes", label: "Programmes" }, { href: "/portal/admin/programmes?tab=courses", label: "Courses" }]} />;
  if (tab === "courses") {
    let query = db.from("courses").select("*").order("code");
    if (q) query = query.or(`code.ilike.%${q.replace(/[%_,()]/g, "")}%,title.ilike.%${q.replace(/[%_,()]/g, "")}%`);
    if (programme) query = query.eq("programme_id", programme);
    const { data } = await query.limit(300);
    return (
      <>
        <PageHeader title="Programmes & courses" />
        {tabs}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <FilterBar q={q} placeholder="Search code or title" className="mb-4" hidden={{ tab: "courses" }}>
              <FilterSelect name="programme" value={programme} label="Programme" options={lk.programmes.map((p) => ({ value: p.id, label: p.name }))} />
            </FilterBar>
            <Card>
              {(data ?? []).length === 0 ? <EmptyState title="No courses" /> : (data ?? []).map((c) => (
                <EditRow key={c.id} summary={<div className="flex flex-wrap items-center gap-x-3"><span className="tabular text-xs text-faint">{c.code}</span><span className="font-medium">{c.title}</span><span className="text-xs text-muted">{c.credits} cr · Sem {c.semester_number ?? "—"}</span>{!c.is_active && <Badge>Inactive</Badge>}</div>}>
                  <CourseForm d={c} id={c.id} departments={lk.departments} programmes={lk.programmes} />
                </EditRow>
              ))}
            </Card>
          </div>
          <Card className="h-fit"><CardHeader title="Add course" /><CardBody><CourseForm departments={lk.departments} programmes={lk.programmes} /></CardBody></Card>
        </div>
      </>
    );
  }
  const { data } = await db.from("programmes").select("*, departments(name), courses(count), students(count)").order("name");
  return (
    <>
      <PageHeader title="Programmes & courses" />
      {tabs}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          {(data ?? []).length === 0 ? <EmptyState title="No programmes" /> : (data ?? []).map((p) => (
            <EditRow key={p.id} summary={<div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Badge tone="accent">{p.level}</Badge><span className="font-medium">{p.name}</span><span className="text-xs text-muted">{(p.departments as { name: string }).name} · {(p.courses as { count: number }[])[0]?.count ?? 0} courses · {(p.students as { count: number }[])[0]?.count ?? 0} students</span>{!p.is_published && <Badge tone="warning">Hidden</Badge>}</div>}>
              <ProgrammeForm d={p} id={p.id} departments={lk.departments} />
            </EditRow>
          ))}
        </Card>
        <Card className="h-fit"><CardHeader title="Add programme" /><CardBody><ProgrammeForm departments={lk.departments} /></CardBody></Card>
      </div>
    </>
  );
}
