import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { facultyOptions } from "@/lib/data/lookups";
import { PageHeader, KeyValue } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DAY_NAMES, formatTime } from "@/lib/format";
import { FacultyAssign, SlotForm, SlotRemove, SyncButton } from "../forms";

export const metadata = { title: "Offering" };

export default async function OfferingDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePortal("admin");
  const { id } = await params;
  const db = await createClient();
  const { data: o } = await db.from("course_offerings").select("id, semester_number, courses(code, title, credits), terms(name), batches(name), offering_faculty(faculty_id, faculty(profiles(full_name))), enrolments(count)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const { data: slots } = await db.from("timetable_slots").select("*").eq("offering_id", id).order("day_of_week").order("starts_at");
  const fac = await facultyOptions();
  const off = o as unknown as { courses: { code: string; title: string; credits: number }; terms: { name: string }; batches: { name: string }; semester_number: number; offering_faculty: { faculty_id: string; faculty: { profiles: { full_name: string } } }[]; enrolments: { count: number }[] };
  return (
    <>
      <PageHeader eyebrow={off.terms.name} title={`${off.courses.code} · ${off.courses.title}`} back={{ href: "/portal/admin/offerings", label: "Offerings" }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card><CardBody><KeyValue items={[{ label: "Division", value: off.batches.name }, { label: "Term", value: off.semester_number }, { label: "Credits", value: Number(off.courses.credits) }, { label: "Enrolled", value: off.enrolments[0]?.count ?? 0 }]} /><div className="mt-4"><SyncButton offeringId={id} /></div></CardBody></Card>
          <Card>
            <CardHeader title="Teachers" description="Only assigned teachers can see the class and enter marks." />
            <CardBody><FacultyAssign offeringId={id} options={fac} assigned={off.offering_faculty.map((f) => ({ value: f.faculty_id, label: f.faculty.profiles.full_name }))} /></CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="Weekly timetable" />
          <ul className="divide-y divide-line">
            {(slots ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span><span className="font-medium">{DAY_NAMES[s.day_of_week]}</span> <span className="tabular text-muted">{formatTime(s.starts_at)} – {formatTime(s.ends_at)}</span> {s.room && <span className="text-muted">· {s.room}</span>}</span>
                <SlotRemove offeringId={id} slotId={s.id} />
              </li>
            ))}
            {!slots?.length && <li className="px-5 py-4 text-sm text-muted">No periods scheduled yet.</li>}
          </ul>
          <CardBody className="border-t border-line"><SlotForm offeringId={id} /></CardBody>
        </Card>
      </div>
    </>
  );
}
