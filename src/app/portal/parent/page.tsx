import Link from "next/link";
import { Award, CalendarDays, MessageSquare, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { pickStudent } from "@/lib/data/parent";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard, EmptyState, KeyValue } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { StudentSwitcher, NoLinkedStudent } from "@/components/portal/student-switcher";
import { formatMoney } from "@/lib/fees";
import { formatDate, greeting, humanize, todayISO } from "@/lib/format";
import { sgpa } from "@/lib/grades";

export const metadata = { title: "Parent Dashboard" };

export default async function ParentDashboard({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { user, students, current, pending } = await pickStudent((await searchParams).student);
  if (!current) return <><h1 className="mb-6 font-display text-[28px] font-semibold">{greeting()}, {user.fullName.split(" ")[0]}</h1><NoLinkedStudent pending={pending} /></>;
  const supabase = await createClient();
  const [{ data: results }, { data: bal }, { data: notices }, { data: calendar }, { data: threads }] = await Promise.all([
    supabase.from("results").select("exam_id, credits, grade_point, passed, published_at, exams(name)").eq("student_id", current.student_id).order("published_at", { ascending: false }),
    supabase.from("student_fee_balances").select("*").eq("student_id", current.student_id).maybeSingle(),
    supabase.from("notices").select("id, title, published_at, category, is_important").eq("status", "published").order("published_at", { ascending: false }).limit(5),
    supabase.from("calendar_entries").select("id, title, starts_on, category").gte("starts_on", todayISO()).order("starts_on").limit(5),
    supabase.from("parent_threads").select("id, subject, status, updated_at").eq("parent_id", user.id).eq("student_id", current.student_id).order("updated_at", { ascending: false }).limit(3),
  ]);
  const rows = (results ?? []) as unknown as { exam_id: string; credits: number; grade_point: number; passed: boolean; published_at: string; exams: { name: string } }[];
  const latestExam = rows[0]?.exam_id;
  const latest = rows.filter((r) => r.exam_id === latestExam);
  const q = `?student=${current.student_id}`;
  return (
    <>
      <h1 className="mb-1 font-display text-[28px] font-semibold tracking-tight">{greeting()}, {user.fullName.split(" ")[0]}</h1>
      <p className="mb-6 text-sm text-muted">Information shared with you about your ward, with the school&rsquo;s authorisation.</p>
      <StudentSwitcher students={students} current={current} base="/portal/parent" />
      <Card className="mb-6">
        <CardBody className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
          <div>
            <p className="font-display text-2xl font-semibold">{current.full_name}</p>
            <p className="text-sm text-muted">{humanize(current.relationship)} link · {current.register_no}</p>
          </div>
          <KeyValue columns={3} items={[
            { label: "Class", value: current.programme }, { label: "Department", value: current.department },
            { label: "Term", value: current.current_semester },
          ]} />
        </CardBody>
      </Card>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Latest SGPA" value={latest.length ? sgpa(latest.map((r) => ({ credits: Number(r.credits), grade_point: Number(r.grade_point) }))) ?? "—" : "—"} hint={latest[0]?.exams?.name} icon={Award} tone="teal" href={`/portal/parent/results${q}`} />
        <StatCard label="Fees outstanding" value={formatMoney(bal?.outstanding ?? 0)} hint={bal?.next_due ? `Due ${formatDate(bal.next_due)}` : "Nothing due"} icon={Wallet} tone={Number(bal?.outstanding) > 0 ? "accent" : "neutral"} href={`/portal/parent/fees${q}`} />
        <StatCard label="Upcoming dates" value={calendar?.length ?? 0} icon={CalendarDays} />
        <StatCard label="Conversations" value={threads?.length ?? 0} icon={MessageSquare} href="/portal/parent/messages" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="School notices" action={<Link href="/portal/parent/notices" className="text-[13px] font-medium text-royal hover:underline">All</Link>} />
          {(notices ?? []).length === 0 ? <EmptyState title="No notices" /> : (
            <ul className="divide-y divide-line">{(notices ?? []).map((n) => <li key={n.id} className="px-5 py-3"><p className="text-sm font-medium">{n.title} {n.is_important && <Badge tone="accent">Important</Badge>}</p><p className="text-xs text-muted">{formatDate(n.published_at)} · {humanize(n.category)}</p></li>)}</ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Academic calendar" />
          {(calendar ?? []).length === 0 ? <EmptyState title="No upcoming dates" /> : (
            <ul className="divide-y divide-line">{(calendar ?? []).map((c) => <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3"><span className="text-sm font-medium">{c.title}</span><span className="tabular shrink-0 text-xs text-muted">{formatDate(c.starts_on)}</span></li>)}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
