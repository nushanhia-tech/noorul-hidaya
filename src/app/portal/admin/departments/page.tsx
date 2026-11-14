import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepartmentForm, EditRow } from "../academic-forms";

export const metadata = { title: "Departments" };

export default async function DepartmentsAdmin() {
  await requirePortal("admin");
  const db = await createClient();
  const { data } = await db.from("departments").select("*, programmes(count), faculty(count)").order("sort_order").order("name");
  return (
    <>
      <PageHeader title="Departments" description="Departments appear on the public website and own classes, subjects and teacher." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          {(data ?? []).length === 0 ? <EmptyState title="No departments yet" /> : (data ?? []).map((d) => (
            <EditRow key={d.id} summary={
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="tabular text-xs font-semibold text-accent">{d.code}</span>
                <span className="font-medium">{d.name}</span>
                {!d.is_published && <Badge tone="warning">Hidden</Badge>}
                <span className="text-xs text-muted">{(d.programmes as { count: number }[])[0]?.count ?? 0} classes · {(d.faculty as { count: number }[])[0]?.count ?? 0} teacher</span>
              </div>
            }>
              <DepartmentForm d={d} id={d.id} />
            </EditRow>
          ))}
        </Card>
        <Card className="h-fit"><CardHeader title="Add department" /><CardBody><DepartmentForm /></CardBody></Card>
      </div>
    </>
  );
}
