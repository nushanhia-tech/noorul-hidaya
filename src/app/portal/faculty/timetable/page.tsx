import { getMyFaculty, getMyOfferings } from "@/lib/data/faculty";
import { getSlotsFor } from "@/lib/data/student";
import { PageHeader } from "@/components/ui/misc";
import { WeekTimetable } from "@/components/portal/timetable";
import { isoWeekday } from "@/lib/format";

export const metadata = { title: "Teaching Timetable" };

export default async function FacultyTimetable() {
  const { faculty } = await getMyFaculty();
  const offerings = await getMyOfferings(faculty.id);
  const byId = new Map(offerings.map((o) => [o.id, o]));
  const slots = await getSlotsFor(offerings.map((o) => o.id));
  const entries = slots.map((s) => {
    const o = byId.get(s.offering_id)!;
    return { id: s.id, day: s.day_of_week, start: s.starts_at, end: s.ends_at, room: s.room, title: o.courses?.title ?? "", code: o.courses?.code ?? "", sub: o.batches?.name };
  });
  return (
    <>
      <PageHeader title="Teaching timetable" description={offerings[0]?.terms?.name ?? "Current term"} />
      <WeekTimetable entries={entries} today={isoWeekday()} />
    </>
  );
}
