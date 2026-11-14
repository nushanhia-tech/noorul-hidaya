import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { lookups, facultyOptions } from "@/lib/data/lookups";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { DAY_NAMES, formatTime } from "@/lib/format";
import { AddPeriodForm, RemovePeriod } from "./forms";

export const metadata = { title: "Timetable Schedule" };

type Off = { id: string; batch_id: string; courses: { code: string; title: string }; batches: { name: string }; offering_faculty: { faculty_id: string; faculty: { profiles: { full_name: string } } }[]; timetable_slots: { id: string; day_of_week: number; starts_at: string; ends_at: string; room: string }[] };

export default async function TimetableSchedule({ searchParams }: { searchParams: Promise<{ term?: string; by?: string; batch?: string; faculty?: string }> }) {
  await requirePortal("admin");
  const sp = await searchParams;
  const by = sp.by === "faculty" ? "faculty" : "class";
  const [lk, fac] = await Promise.all([lookups(), facultyOptions()]);
  const term = sp.term ?? lk.terms.find((t) => t.is_current)?.id ?? lk.terms[0]?.id;
  const db = await createClient();
  const { data } = term ? await db.from("course_offerings").select("id, batch_id, courses(code, title), batches(name), offering_faculty(faculty_id, faculty(profiles(full_name))), timetable_slots(id, day_of_week, starts_at, ends_at, room)").eq("term_id", term) : { data: [] };
  const all = (data ?? []) as unknown as Off[];
  const batchOpts = [...new Map(all.map((o) => [o.batch_id, o.batches.name])).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  const selected = by === "class" ? sp.batch ?? batchOpts[0]?.value : sp.faculty ?? fac[0]?.value;
  const shown = all.filter((o) => (by === "class" ? o.batch_id === selected : o.offering_faculty.some((f) => f.faculty_id === selected)));
  const slots = shown.flatMap((o) => o.timetable_slots.map((s) => ({ ...s, o })));
  const days = [1, 2, 3, 4, 5, 6];
  const periods = [...new Map(slots.map((s) => [`${s.starts_at}|${s.ends_at}`, { start: s.starts_at, end: s.ends_at }])).values()].sort((a, b) => a.start.localeCompare(b.start));
  const teachers = (o: Off) => o.offering_faculty.map((f) => f.faculty.profiles.full_name).join(", ") || "No teacher";
  const q = `term=${term ?? ""}`;
  const pdf = (type: string, extra = "") => `/api/reports/timetable?type=${type}&${q}${extra}`;
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-white px-3 text-sm hover:bg-ivory";
  return (
    <>
      <PageHeader title="Timetable schedule" description="Weekly timetable grid for each class and each teacher. Download in landscape for printing." />
      <Tabs active={`/portal/admin/timetable?by=${by}`} items={[{ href: "/portal/admin/timetable?by=class", label: "By class" }, { href: "/portal/admin/timetable?by=faculty", label: "By teacher" }]} />
      <FilterBar className="mb-4" placeholder="—" q={undefined} hidden={{ by }}>
        <FilterSelect name="term" value={term} label="Term" options={lk.terms.map((t) => ({ value: t.id, label: t.name }))} />
        {by === "class" ? <FilterSelect name="batch" value={selected} label="Class" options={batchOpts} /> : <FilterSelect name="faculty" value={selected} label="Teacher" options={fac} />}
      </FilterBar>
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-3">
        <span className="mr-1 text-sm font-medium">Print (landscape PDF):</span>
        {selected && <a className={btn} target="_blank" href={pdf(by === "class" ? "grid-class" : "grid-faculty", by === "class" ? `&batch=${selected}` : `&faculty=${selected}`)}><Printer className="h-4 w-4" /> This {by === "class" ? "class" : "teacher"}</a>}
        <a className={btn} target="_blank" href={pdf("grid-class")}><Printer className="h-4 w-4" /> All classes</a>
        <a className={btn} target="_blank" href={pdf("grid-faculty")}><Printer className="h-4 w-4" /> All teachers</a>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          {periods.length === 0 ? <EmptyState title="No periods scheduled" description="Add periods using the form." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead><tr className="bg-ivory"><th className="w-24 border-b border-r border-line px-3 py-2 text-left text-xs font-semibold">Time</th>{days.map((d) => <th key={d} className="border-b border-r border-line px-3 py-2 text-left text-xs font-semibold last:border-r-0">{DAY_NAMES[d]}</th>)}</tr></thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.start + p.end}>
                      <td className="tabular border-b border-r border-line px-3 py-2 align-top text-xs"><span className="font-semibold">{formatTime(p.start)}</span><span className="block text-muted">{formatTime(p.end)}</span></td>
                      {days.map((d) => (
                        <td key={d} className="border-b border-r border-line p-1.5 align-top last:border-r-0">
                          {slots.filter((s) => s.day_of_week === d && s.starts_at === p.start && s.ends_at === p.end).map((s) => (
                            <div key={s.id} className="group relative rounded-sm bg-accent-50 px-2 py-1.5">
                              <p className="pr-5 text-[12.5px] font-medium leading-snug">{s.o.courses.title}</p>
                              <p className="text-[11px] text-muted">{by === "class" ? teachers(s.o) : s.o.batches.name}{s.room && ` · ${s.room}`}</p>
                              <RemovePeriod id={s.id} />
                            </div>
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader title="Add a period" description="Clashes for the class or teacher are blocked." />
          <CardBody>
            {shown.length ? <AddPeriodForm offerings={shown.map((o) => ({ value: o.id, label: `${o.courses.title} — ${by === "class" ? teachers(o) : o.batches.name}` }))} />
              : <p className="text-sm text-muted">No subjects for this selection. Create them in Offerings &amp; Timetable first.</p>}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
