import Link from "next/link";
import { ArrowRight, Award, BookOpen, CalendarClock, LifeBuoy, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getEnrolledOfferings, getSlotsFor, facultyNames } from "@/lib/data/student";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard, EmptyState } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DayAgenda } from "@/components/portal/timetable";
import { formatMoney } from "@/lib/fees";
import { formatDate, formatTime, greeting, isoWeekday, todayISO, relativeTime } from "@/lib/format";

export const metadata = { title: "Student Dashboard" };

export default async function StudentDashboard() {
  const { user, student } = await getMyStudent();
  const supabase = await createClient();
  const offerings = await getEnrolledOfferings(student.id);
  const ids = offerings.map((o) => o.id);
  const byId = new Map(offerings.map((o) => [o.id, o]));
  const today = isoWeekday();
  const [slots, exams, results, balance, materials, notices, tickets] = await Promise.all([
    getSlotsFor(ids),
    ids.length ? supabase.from("exam_sessions").select("id, sits_on, starts_at, ends_at, venue, offering_id, exams(name)").in("offering_id", ids).gte("sits_on", todayISO()).order("sits_on").limit(5) : { data: [] },
    supabase.from("results").select("id, course_code, course_title, grade, published_at, exams(name)").eq("student_id", student.id).order("published_at", { ascending: false }).limit(5),
    supabase.from("student_fee_balances").select("*").eq("student_id", student.id).maybeSingle(),
    ids.length ? supabase.from("study_resources").select("id, title, created_at, offering_id").in("offering_id", ids).eq("is_published", true).order("created_at", { ascending: false }).limit(4) : { data: [] },
    supabase.from("notices").select("id, title, published_at, is_important").eq("status", "published").order("published_at", { ascending: false }).limit(4),
    supabase.from("tickets").select("id, ticket_no, subject, status, updated_at").eq("requester_id", user.id).not("status", "eq", "closed").order("updated_at", { ascending: false }).limit(3),
  ]);
  const todays = slots.filter((s) => s.day_of_week === today).map((s) => {
    const o = byId.get(s.offering_id);
    return { id: s.id, day: s.day_of_week, start: s.starts_at, end: s.ends_at, room: s.room, title: o?.courses?.title ?? "", code: o?.courses?.code ?? "", sub: o ? facultyNames(o) : "" };
  });
  const bal = balance.data;
  const exList = (exams.data ?? []) as unknown as { id: string; sits_on: string; starts_at: string; venue: string; offering_id: string; exams: { name: string } | null }[];
  const resList = (results.data ?? []) as unknown as { id: string; course_code: string; course_title: string; grade: string; published_at: string; exams: { name: string } | null }[];

  return (
    <>
      <section className="mb-8 flex flex-col gap-5 rounded-md border border-line bg-paper p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight sm:text-[32px]">{user.fullName}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {student.programmes?.name} · Semester {student.current_semester}
            {student.batches && <> · {student.batches.name}</>}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <dt className="text-faint">Register no.</dt><dd className="tabular font-medium">{student.register_no}</dd>
          <dt className="text-faint">Department</dt><dd className="font-medium">{student.programmes?.departments?.name}</dd>
        </dl>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Periods today" value={todays.length} icon={CalendarClock} tone="teal" href="/portal/student/timetable" />
        <StatCard label="Upcoming exams" value={exList.length} icon={BookOpen} tone="royal" />
        <StatCard label="Fees outstanding" value={formatMoney(bal?.outstanding ?? 0)} hint={bal?.next_due ? `Next due ${formatDate(bal.next_due)}` : "Nothing due"} icon={Wallet} tone={Number(bal?.outstanding) > 0 ? "accent" : "neutral"} href="/portal/student/fees" />
        <StatCard label="Open requests" value={tickets.data?.length ?? 0} icon={LifeBuoy} tone="plum" href="/portal/student/helpdesk" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Today's timetable" action={<Link href="/portal/student/timetable" className="text-[13px] font-medium text-royal hover:underline">Full week</Link>} />
            <CardBody><DayAgenda entries={todays} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Upcoming examinations" />
            {exList.length === 0 ? <EmptyState title="No examinations scheduled" /> : (
              <ul className="divide-y divide-line">
                {exList.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{byId.get(e.offering_id)?.courses?.title}</p>
                      <p className="text-xs text-muted">{e.exams?.name}{e.venue && ` · ${e.venue}`}</p>
                    </div>
                    <p className="tabular shrink-0 text-right text-sm"><span className="font-medium">{formatDate(e.sits_on, { day: "numeric", month: "short" })}</span><span className="block text-xs text-muted">{formatTime(e.starts_at)}</span></p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Recently published results" action={<Link href="/portal/student/results" className="text-[13px] font-medium text-royal hover:underline">All results</Link>} />
            {resList.length === 0 ? <EmptyState icon={Award} title="No published results yet" /> : (
              <ul className="divide-y divide-line">
                {resList.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{r.course_title}</p><p className="text-xs text-muted">{r.exams?.name}</p></div>
                    <Badge tone={r.grade === "F" ? "danger" : "success"}>{r.grade}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Study materials" action={<Link href="/portal/student/materials" className="text-[13px] font-medium text-royal hover:underline">Browse</Link>} />
            {(materials.data ?? []).length === 0 ? <EmptyState icon={BookOpen} title="No materials yet" /> : (
              <ul className="divide-y divide-line">
                {(materials.data ?? []).map((m) => (
                  <li key={m.id} className="px-5 py-3"><a href={`/api/resources/${m.id}`} className="text-sm font-medium hover:underline">{m.title}</a><p className="text-xs text-muted">{byId.get(m.offering_id)?.courses?.code} · {relativeTime(m.created_at)}</p></li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="School notices" action={<Link href="/portal/student/notices" className="text-[13px] font-medium text-royal hover:underline">All</Link>} />
            {(notices.data ?? []).length === 0 ? <EmptyState title="No notices" /> : (
              <ul className="divide-y divide-line">
                {(notices.data ?? []).map((n) => (
                  <li key={n.id} className="px-5 py-3"><p className="text-sm font-medium">{n.title} {n.is_important && <Badge tone="accent">Important</Badge>}</p><p className="text-xs text-muted">{formatDate(n.published_at)}</p></li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Help desk" action={<Link href="/portal/student/helpdesk/new" className="text-[13px] font-medium text-royal hover:underline">New request</Link>} />
            {(tickets.data ?? []).length === 0 ? <EmptyState icon={LifeBuoy} title="No open requests" description="Need a certificate, receipt or record correction? Raise a request." /> : (
              <ul className="divide-y divide-line">
                {(tickets.data ?? []).map((t) => (
                  <li key={t.id}><Link href={`/portal/student/helpdesk/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{t.subject}</span><span className="text-xs text-muted">{t.ticket_no}</span></span>
                    <StatusBadge status={t.status} />
                  </Link></li>
                ))}
              </ul>
            )}
            <div className="border-t border-line px-5 py-3"><Link href="/portal/student/helpdesk" className="inline-flex items-center gap-1 text-[13px] font-medium">View history <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          </Card>
        </div>
      </div>
    </>
  );
}
