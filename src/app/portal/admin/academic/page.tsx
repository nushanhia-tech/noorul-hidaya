import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { lookups } from "@/lib/data/lookups";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { BatchForm, EditRow, TermForm, YearForm } from "../academic-forms";

export const metadata = { title: "Academic Setup" };

export default async function AcademicSetup() {
  await requirePortal("admin");
  const lk = await lookups();
  const db = await createClient();
  const [{ data: years }, { data: terms }, { data: batches }] = await Promise.all([
    db.from("academic_years").select("*").order("starts_on", { ascending: false }),
    db.from("terms").select("*, academic_years(label)").order("starts_on", { ascending: false }),
    db.from("batches").select("*, programmes(name), students(count)").order("start_year", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="Academic setup" description="Academic years, term terms and student divisions." />
      <div className="space-y-8">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Academic years" />
            {(years ?? []).length === 0 ? <EmptyState title="No academic years" /> : (years ?? []).map((y) => (
              <EditRow key={y.id} summary={<span className="flex items-center gap-3"><span className="font-medium">{y.label}</span><span className="text-xs text-muted">{formatDate(y.starts_on)} – {formatDate(y.ends_on)}</span>{y.is_current && <Badge tone="teal">Current</Badge>}</span>}>
                <YearForm d={y} id={y.id} />
              </EditRow>
            ))}
          </Card>
          <Card className="h-fit"><CardHeader title="Add academic year" /><CardBody><YearForm /></CardBody></Card>
        </section>
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Terms" />
            {(terms ?? []).length === 0 ? <EmptyState title="No terms" /> : (terms ?? []).map((t) => (
              <EditRow key={t.id} summary={<span className="flex flex-wrap items-center gap-3"><span className="font-medium">{t.name}</span><span className="text-xs text-muted">{formatDate(t.starts_on)} – {formatDate(t.ends_on)}</span>{t.is_current && <Badge tone="teal">Current</Badge>}</span>}>
                <TermForm d={t} id={t.id} years={lk.years} />
              </EditRow>
            ))}
          </Card>
          <Card className="h-fit"><CardHeader title="Add term" /><CardBody><TermForm years={lk.years} /></CardBody></Card>
        </section>
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Divisions" />
            {(batches ?? []).length === 0 ? <EmptyState title="No divisions" /> : (batches ?? []).map((b) => (
              <EditRow key={b.id} summary={<span className="flex flex-wrap items-center gap-3"><span className="font-medium">{b.name}</span><span className="text-xs text-muted">{(b.programmes as { name: string }).name} · Sem {b.current_semester} · {(b.students as { count: number }[])[0]?.count ?? 0} students</span>{!b.is_active && <Badge>Inactive</Badge>}</span>}>
                <BatchForm d={b} id={b.id} programmes={lk.programmes} />
              </EditRow>
            ))}
          </Card>
          <Card className="h-fit"><CardHeader title="Add division" /><CardBody><BatchForm programmes={lk.programmes} /></CardBody></Card>
        </section>
      </div>
    </>
  );
}
