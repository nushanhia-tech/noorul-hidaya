import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, can } from "@/lib/auth/session";
import { PdfBuilder, pdfResponse } from "@/lib/pdf/document";
import { getLetterhead } from "@/lib/pdf/letterhead";
import { timetableGridPdf, type GridPage } from "@/lib/pdf/timetable-grid";
import { DAY_NAMES, formatDateTime, formatTime } from "@/lib/format";

type Offering = {
  id: string; semester_number: number;
  courses: { code: string; title: string };
  batches: { id: string; name: string };
  offering_faculty: { faculty: { id: string; profiles: { full_name: string } } }[];
  timetable_slots: { day_of_week: number; starts_at: string; ends_at: string; room: string }[];
};

/**
 * Timetable PDFs for a term.
 *   type=class    one timetable per class (batch)      [&batch=<id>]
 *   type=faculty  one timetable per teacher            [&faculty=<id>]
 *   type=all      every class with subject and teacher, plus the full weekly timetable
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });
  if (!can(user, "academics.manage")) return new NextResponse("Forbidden", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") ?? "all";
  if (!["class", "faculty", "all", "grid-class", "grid-faculty"].includes(type)) return new NextResponse("Unknown type", { status: 400 });

  const db = await createClient();
  const termId = sp.get("term");
  const termQ = db.from("terms").select("id, name");
  const { data: term } = await (termId ? termQ.eq("id", termId) : termQ.eq("is_current", true)).maybeSingle();
  if (!term) return new NextResponse("Term not found", { status: 404 });

  let q = db.from("course_offerings")
    .select("id, semester_number, courses(code, title), batches(id, name), offering_faculty(faculty(id, profiles(full_name))), timetable_slots(day_of_week, starts_at, ends_at, room)")
    .eq("term_id", term.id);
  if (sp.get("batch")) q = q.eq("batch_id", sp.get("batch")!);
  const { data } = await q;
  let offerings = (data ?? []) as unknown as Offering[];
  const facultyFilter = sp.get("faculty");
  if (facultyFilter) offerings = offerings.filter((o) => o.offering_faculty.some((f) => f.faculty.id === facultyFilter));

  const teachers = (o: Offering) => o.offering_faculty.map((f) => f.faculty.profiles.full_name).join(", ") || "Not assigned";
  const subject = (o: Offering) => `${o.courses.code} - ${o.courses.title}`;
  const slotRows = (list: Offering[], cols: (o: Offering) => string[]) =>
    list.flatMap((o) => o.timetable_slots.map((s) => ({ s, o })))
      .sort((a, b) => a.s.day_of_week - b.s.day_of_week || a.s.starts_at.localeCompare(b.s.starts_at))
      .map(({ s, o }) => [DAY_NAMES[s.day_of_week], `${formatTime(s.starts_at)} - ${formatTime(s.ends_at)}`, ...cols(o), s.room || "-"]);

  // Landscape print grids: one page per class or per teacher.
  if (type === "grid-class" || type === "grid-faculty") {
    const pages: GridPage[] = [];
    if (type === "grid-class") {
      const batches = [...new Map(offerings.map((o) => [o.batches.id, o.batches.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
      for (const [id, name] of batches) pages.push({ title: name, subtitle: term.name, slots: offerings.filter((o) => o.batches.id === id).flatMap((o) => o.timetable_slots.map((t) => ({ day: t.day_of_week, start: t.starts_at, end: t.ends_at, line1: o.courses.title, line2: teachers(o), room: t.room }))) });
    } else {
      const people = new Map<string, string>();
      for (const o of offerings) for (const f of o.offering_faculty) people.set(f.faculty.id, f.faculty.profiles.full_name);
      for (const [id, name] of [...people.entries()].filter(([i]) => !facultyFilter || i === facultyFilter).sort((a, b) => a[1].localeCompare(b[1]))) {
        pages.push({ title: name, subtitle: term.name, slots: offerings.filter((o) => o.offering_faculty.some((f) => f.faculty.id === id)).flatMap((o) => o.timetable_slots.map((t) => ({ day: t.day_of_week, start: t.starts_at, end: t.ends_at, line1: o.courses.title, line2: o.batches.name, room: t.room }))) });
      }
    }
    return pdfResponse(await timetableGridPdf(await getLetterhead(), pages), `timetable-${type}-${term.name.replace(/\s+/g, "-")}.pdf`, true);
  }

  const pdf = await PdfBuilder.create(await getLetterhead());
  const stamp = `${term.name}  |  Generated ${formatDateTime(new Date())}`;
  const section = (heading: string) => { pdf.ensure(90); pdf.text(heading, { size: 12, font: pdf.bold }); pdf.space(4); };
  const none = () => { pdf.text("No periods scheduled.", { size: 9.5 }); pdf.space(8); };

  if (type === "class") {
    pdf.title("Class-wise timetable", stamp);
    const batches = [...new Map(offerings.map((o) => [o.batches.id, o.batches.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    if (!batches.length) none();
    for (const [id, name] of batches) {
      const list = offerings.filter((o) => o.batches.id === id);
      section(name);
      const rows = slotRows(list, (o) => [subject(o), teachers(o)]);
      if (rows.length) pdf.table(["Day", "Time", "Subject", "Teacher", "Room"], rows, [1.1, 1.6, 3, 2.2, 1]); else none();
    }
  } else if (type === "faculty") {
    pdf.title("Teacher-wise timetable", stamp);
    const people = new Map<string, string>();
    for (const o of offerings) for (const f of o.offering_faculty) people.set(f.faculty.id, f.faculty.profiles.full_name);
    const sorted = [...people.entries()].filter(([id]) => !facultyFilter || id === facultyFilter).sort((a, b) => a[1].localeCompare(b[1]));
    if (!sorted.length) none();
    for (const [id, name] of sorted) {
      const list = offerings.filter((o) => o.offering_faculty.some((f) => f.faculty.id === id));
      section(`${name}  (${list.reduce((n, o) => n + o.timetable_slots.length, 0)} periods per week)`);
      const rows = slotRows(list, (o) => [subject(o), o.batches.name]);
      if (rows.length) pdf.table(["Day", "Time", "Subject", "Class", "Room"], rows, [1.1, 1.6, 3, 2.2, 1]); else none();
    }
  } else {
    pdf.title("All classes: subjects and teachers", stamp);
    const sorted = [...offerings].sort((a, b) => a.batches.name.localeCompare(b.batches.name) || a.courses.code.localeCompare(b.courses.code));
    pdf.table(["Class", "Sem", "Subject", "Teacher", "Periods/wk"],
      sorted.map((o) => [o.batches.name, o.semester_number, subject(o), teachers(o), o.timetable_slots.length]), [2.2, 0.6, 3.2, 2.4, 1], ["left", "right", "left", "left", "right"]);
    section("Full weekly timetable");
    const rows = slotRows(sorted, (o) => [o.batches.name, subject(o), teachers(o)]);
    if (rows.length) pdf.table(["Day", "Time", "Class", "Subject", "Teacher", "Room"], rows, [1, 1.5, 1.8, 2.6, 2, 0.9]); else none();
  }
  pdf.footer(`${term.name} timetable`);
  return pdfResponse(await pdf.bytes(), `timetable-${type}-${term.name.replace(/\s+/g, "-")}.pdf`);
}
