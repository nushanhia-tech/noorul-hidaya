import Link from "next/link";
import { CalendarClock, LibraryBig, PenLine, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyFaculty, getMyOfferings, offeringLabel } from "@/lib/data/faculty";
import { getSlotsFor } from "@/lib/data/student";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard, EmptyState } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DayAgenda } from "@/components/portal/timetable";
import { formatDate, greeting, isoWeekday, relativeTime } from "@/lib/format";

export const metadata = { title: "Faculty Dashboard" };

export default async function FacultyDashboard() {
  const { user, faculty } = await getMyFaculty();
  const offerings = await getMyOfferings(faculty.id);
  const ids = offerings.map((o) => o.id);
  const byId = new Map(offerings.map((o) => [o.id, o]));
  const supabase = await createClient();
  const today = isoWeekday();
  const [slots, exams, sheets, notices, resources] = await Promise.all([
    getSlotsFor(ids),
    supabase.from("exams").select("id, name, status, terms!inner(is_current)").eq("status", "marks_entry").eq("terms.is_current", true),
    ids.length ? supabase.from("mark_sheets").select("exam_id, offering_id, status").in("offering_id", ids) : { data: [] },
    supabase.from("notices").select("id, title, published_at, is_important").eq("status", "published").order("published_at", { ascending: false }).limit(4),
    ids.length ? supabase.from("study_resources").select("id, title, created_at, offering_id").in("offering_id", ids).order("created_at", { ascending: false }).limit(4) : { data: [] },
  ]);
  const sheetMap = new Map((sheets.data ?? []).map((s) => [`${s.exam_id}:${s.offering_id}`, s.status]));
  const pending = (exams.data ?? []).flatMap((e) => offerings.map((o) => ({ exam: e, offering: o, status: sheetMap.get(`${e.id}:${o.id}`) ?? "not_started" })))
    .filter((p) => p.status !== "submitted");
  const todays = slots.filter((s) => s.day_of_week === today).map((s) => {
    const o = byId.get(s.offering_id)!;
    return { id: s.id, day: s.day_of_week, start: s.starts_at, end: s.ends_at, room: s.room, title: o.courses?.title ?? "", code: o.courses?.code ?? "", sub: o.batches?.name ?? "" };
  });
  const students = offerings.reduce((n, o) => n + (o.enrolments?.[0]?.count ?? 0), 0);

  return (
    <>
      <section className="mb-8 rounded-md border border-line bg-paper p-5 sm:p-7">
        <p className="text-sm text-muted">{greeting()},</p>
        <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight sm:text-[32px]">{user.fullName}</h1>
        <p className="mt-2 text-sm text-ink-soft">{faculty.designation} · {faculty.departments?.name}{faculty.is_hod && " · Head of Department"}</p>
      </section>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Courses this term" value={offerings.length} icon={LibraryBig} tone="royal" href="/portal/faculty/courses" />
        <StatCard label="Classes today" value={todays.length} icon={CalendarClock} tone="teal" href="/portal/faculty/timetable" />
        <StatCard label="Students taught" value={students} icon={Users} />
        <StatCard label="Pending mark sheets" value={pending.length} icon={PenLine} tone={pending.length ? "accent" : "neutral"} href="/portal/faculty/marks" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Today's classes" action={<Link className="text-[13px] font-medium text-royal hover:underline" href="/portal/faculty/timetable">Week view</Link>} />
            <CardBody><DayAgenda entries={todays} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Pending marks entry" />
            {pending.length === 0 ? <EmptyState icon={PenLine} title="Nothing pending" description="All mark sheets for open examinations are submitted." /> : (
              <ul className="divide-y divide-line">
                {pending.map((p) => (
                  <li key={`${p.exam.id}:${p.offering.id}`}>
                    <Link href={`/portal/faculty/marks/${p.exam.id}/${p.offering.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-white">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{offeringLabel(p.offering)}</span><span className="text-xs text-muted">{p.exam.name} · {p.offering.batches?.name}</span></span>
                      <StatusBadge status={p.status === "not_started" ? "todo" : p.status} label={p.status === "not_started" ? "Not started" : undefined} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Assigned courses" />
            {offerings.length === 0 ? <EmptyState title="No courses assigned for the current term" /> : (
              <ul className="divide-y divide-line">
                {offerings.map((o) => (
                  <li key={o.id}><Link href={`/portal/faculty/courses/${o.id}`} className="block px-5 py-3 hover:bg-white">
                    <span className="block text-sm font-medium">{offeringLabel(o)}</span>
                    <span className="text-xs text-muted">{o.batches?.name} · Sem {o.semester_number} · {o.enrolments?.[0]?.count ?? 0} students</span>
                  </Link></li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Academic notices" action={<Link className="text-[13px] font-medium text-royal hover:underline" href="/portal/faculty/notices">All</Link>} />
            {(notices.data ?? []).length === 0 ? <EmptyState title="No notices" /> : (
              <ul className="divide-y divide-line">{(notices.data ?? []).map((n) => <li key={n.id} className="px-5 py-3"><p className="text-sm font-medium">{n.title} {n.is_important && <Badge tone="accent">Important</Badge>}</p><p className="text-xs text-muted">{formatDate(n.published_at)}</p></li>)}</ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Recently shared resources" action={<Link className="text-[13px] font-medium text-royal hover:underline" href="/portal/faculty/resources">Manage</Link>} />
            {(resources.data ?? []).length === 0 ? <EmptyState title="No resources shared yet" /> : (
              <ul className="divide-y divide-line">{(resources.data ?? []).map((r) => <li key={r.id} className="px-5 py-3"><p className="text-sm font-medium">{r.title}</p><p className="text-xs text-muted">{byId.get(r.offering_id)?.courses?.code} · {relativeTime(r.created_at)}</p></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
