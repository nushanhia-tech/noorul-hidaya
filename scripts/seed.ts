/**
 * DEVELOPMENT / DEMO SEED — FICTIONAL DATA ONLY.
 *
 * Creates a small fictional college so every portal can be explored.
 * All people, emails (@demo.college.test), numbers and amounts are invented.
 * Never run this against a production project that holds real college data.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_PASSWORD='...' npm run seed -- --yes
 *
 * SEED_PASSWORD is required (no default) and is used for every demo account.
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD;

if (!process.argv.includes("--yes")) {
  console.error("This creates FICTIONAL demo accounts and records. Re-run with --yes to confirm.");
  process.exit(1);
}
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
if (!password || password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
  throw new Error("Set SEED_PASSWORD (10+ chars, upper, lower and a digit). There is deliberately no default password.");
}

const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const DOMAIN = "demo.college.test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function must<T = any>(p: PromiseLike<any>, what: string): Promise<T> {
  const { data, error } = (await p) as { data: T; error: { message: string } | null };
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function user(local: string, fullName: string, roles: string[]): Promise<string> {
  const email = `${local}@${DOMAIN}`;
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  let id = list?.users.find((u) => u.email === email)?.id;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) throw new Error(`create ${email}: ${error.message}`);
    id = data.user.id;
  }
  await must(db.from("profiles").update({ full_name: fullName }).eq("id", id), "profile");
  for (const role of roles) await db.from("user_roles").upsert({ user_id: id, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  return id;
}

async function upsert<T extends Record<string, unknown>>(table: string, row: T, onConflict: string): Promise<string> {
  const data = await must(db.from(table).upsert(row, { onConflict }).select("id").single(), table);
  return (data as { id: string }).id;
}

function isoDay(offset: number) {
  return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
}

async function main() {
  console.log("Seeding FICTIONAL demo data…");
  await must(db.from("site_settings").update({
    college_name: "Noorul Hidaya College", short_name: "Noorul Hidaya", motto: "Knowledge with character",
    intro: "A residential college of arts, Islamic studies and sciences, committed to scholarship, discipline and service.",
    established_year: 1998, email: `office@${DOMAIN}`, phone: "+91 00000 00000", address: "Demo address — update in Admin → Settings",
    footer_text: "Demonstration content. Replace every placeholder in Admin → Settings and Website before going live.",
  }).eq("id", 1), "settings");

  // People ----------------------------------------------------------------
  const admin = await user("admin", "Demo Administrator", ["admin"]);
  const supt = await user("superintendent", "Demo Office Superintendent", ["office_superintendent"]);
  const clerk = await user("clerk", "Demo Office Clerk", ["office_clerk"]);
  const accountant = await user("accountant", "Demo Accountant", ["accountant"]);
  await user("supervisor", "Demo Office Supervisor", ["office_supervisor"]);

  // Academic structure -----------------------------------------------------
  const depts = [
    ["ARB", "Department of Arabic", "Language, literature and translation in the classical and modern traditions."],
    ["ISL", "Department of Islamic Studies", "Quran, Hadith, jurisprudence and the intellectual history of Islam."],
    ["COM", "Department of Commerce", "Accounting, finance and business studies with a practical focus."],
    ["ENG", "Department of English", "Literature in English, linguistics and communication."],
  ];
  const deptIds: Record<string, string> = {};
  for (const [i, [code, name, summary]] of depts.entries()) {
    deptIds[code] = await upsert("departments", { code, name, slug: name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""), summary, description: `${summary}\n\nThis is demonstration text. Replace it in Admin → Departments.`, sort_order: i, is_published: true }, "code");
  }
  const progs = [
    ["BA-ARB", "BA Arabic Language & Literature", "ARB", "UG"], ["BA-ISL", "BA Islamic Studies", "ISL", "UG"],
    ["BCOM", "BCom Finance", "COM", "UG"], ["MA-ARB", "MA Arabic", "ARB", "PG"],
  ];
  const progIds: Record<string, string> = {};
  for (const [code, name, dept, level] of progs) {
    progIds[code] = await upsert("programmes", {
      code, name, level, department_id: deptIds[dept], slug: name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""),
      duration_semesters: level === "PG" ? 4 : 6, intake: 40, summary: `A ${level === "PG" ? "two" : "three"}-year programme (demo).`, is_published: true,
    }, "code");
  }
  const year = await upsert("academic_years", { label: "2026-27", starts_on: "2026-06-01", ends_on: "2027-03-31", is_current: true }, "label");
  const { data: existingTerm } = await db.from("terms").select("id").eq("academic_year_id", year).eq("term_type", "odd").maybeSingle();
  const term = existingTerm?.id ?? (await must<{ id: string }>(db.from("terms").insert({ academic_year_id: year, name: "Odd Semester 2026-27", term_type: "odd", starts_on: "2026-06-01", ends_on: "2026-10-31", is_current: true }).select("id").single(), "term")).id;
  const batch = await upsert("batches", { programme_id: progIds["BA-ARB"], name: "BA Arabic 2026–29", start_year: 2026, current_semester: 1 }, "name");

  const courses: [string, string, string][] = [["ARB101", "Arabic Grammar I", "ARB"], ["ARB102", "Classical Arabic Prose", "ARB"], ["ENG101", "Communicative English", "ENG"]];
  const courseIds: string[] = [];
  for (const [code, title, dept] of courses) courseIds.push(await upsert("courses", { code, title, department_id: deptIds[dept], programme_id: progIds["BA-ARB"], credits: 4, semester_number: 1, course_type: code.startsWith("ENG") ? "common" : "core" }, "code"));

  // Faculty
  const facultyIds: string[] = [];
  const teachers: [string, string, string, boolean][] = [["teacher1", "Dr. Demo Faculty One", "ARB", true], ["teacher2", "Demo Faculty Two", "ARB", false], ["teacher3", "Demo Faculty Three", "ENG", true]];
  for (const [i, [local, name, dept, hod]] of teachers.entries()) {
    const pid = await user(local, name, ["faculty"]);
    facultyIds.push(await upsert("faculty", { profile_id: pid, employee_no: `DEMO-EMP-${i + 1}`, department_id: deptIds[dept], designation: hod ? "Associate Professor" : "Assistant Professor", qualification: "MA, PhD (demo)", is_hod: hod }, "profile_id"));
  }

  // Students and a parent
  const studentIds: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const pid = await user(`student${i}`, `Demo Student ${i}`, ["student"]);
    studentIds.push(await upsert("students", { profile_id: pid, register_no: `DEMO2026${String(i).padStart(3, "0")}`, programme_id: progIds["BA-ARB"], batch_id: batch, current_semester: 1, admitted_on: "2026-06-10", guardian_name: `Guardian of Student ${i}` }, "profile_id"));
  }
  const parent = await user("parent1", "Demo Parent One", ["parent"]);
  await db.from("parent_links").upsert({ parent_id: parent, student_id: studentIds[0], relationship: "father", status: "active", consent_recorded: true, verified_at: new Date().toISOString(), verified_by: admin }, { onConflict: "parent_id,student_id" });

  // Offerings, enrolment, timetable
  for (const [i, courseId] of courseIds.entries()) {
    const off = await upsert("course_offerings", { course_id: courseId, term_id: term, batch_id: batch, semester_number: 1 }, "course_id,term_id,batch_id");
    await db.from("offering_faculty").upsert({ offering_id: off, faculty_id: facultyIds[i] }, { onConflict: "offering_id,faculty_id", ignoreDuplicates: true });
    await db.from("enrolments").upsert(studentIds.map((s) => ({ offering_id: off, student_id: s })), { onConflict: "offering_id,student_id", ignoreDuplicates: true });
    const { count } = await db.from("timetable_slots").select("id", { count: "exact", head: true }).eq("offering_id", off);
    if (!count) await must(db.from("timetable_slots").insert([1, 3, 5].map((day) => ({ offering_id: off, day_of_week: day, starts_at: `${9 + i}:30`, ends_at: `${10 + i}:30`, room: `Room 10${i + 1}` }))), "slots");
  }
  await db.from("exams").upsert({ term_id: term, name: "First Internal Assessment", exam_type: "internal", max_marks: 50, status: "marks_entry", starts_on: isoDay(-10), ends_on: isoDay(-5) }, { onConflict: "term_id,name" });

  // Office sections and staff assignment
  const acad = await upsert("office_sections", { name: "Academic Section", code: "ACAD" }, "code");
  await upsert("office_sections", { name: "Accounts Section", code: "ACCT" }, "code");
  await upsert("office_sections", { name: "Establishment", code: "EST" }, "code");
  await db.from("staff_sections").upsert({ user_id: clerk, section_id: acad }, { onConflict: "user_id,section_id", ignoreDuplicates: true });

  // Fees (structures + assignment). Payments are NOT seeded: collect them through the UI.
  const heads = [["TUITION", "Tuition fee", 18000], ["EXAM", "Examination fee", 1500], ["LIB", "Library & lab fee", 1200]] as const;
  const headIds: string[] = [];
  for (const [code, name] of heads) headIds.push(await upsert("fee_heads", { code, name }, "code"));
  const structure = await upsert("fee_structures", { name: "Semester 1 fees", programme_id: progIds["BA-ARB"], academic_year_id: year, semester_number: 1, due_date: isoDay(20), created_by: accountant }, "programme_id,academic_year_id,semester_number,name");
  await db.from("fee_structure_items").upsert(heads.map(([, , amount], i) => ({ structure_id: structure, fee_head_id: headIds[i], amount })), { onConflict: "structure_id,fee_head_id", ignoreDuplicates: true });
  const total = heads.reduce((s, h) => s + h[2], 0);
  for (const s of studentIds) await db.from("invoices").upsert({ invoice_no: "", student_id: s, structure_id: structure, title: "Semester 1 fees (2026-27)", amount: total, due_date: isoDay(20), issued_by: accountant }, { onConflict: "student_id,structure_id", ignoreDuplicates: true });

  // Website content
  await db.from("site_pages").upsert([
    { slug: "about", title: "About the College", status: "published", summary: "Noorul Hidaya College (demo content) brings together classical scholarship and modern disciplines in a calm residential campus.", body: "## Our story\n\nThis is demonstration text. Write the college's real history in Admin → Website → Pages.\n\n## Affiliation\n\nAdd affiliation and accreditation details here." },
    { slug: "mission-vision", title: "Mission & Vision", status: "published", summary: "Combining quality with character.", body: "## Vision\n\nDemonstration text.\n\n## Mission\n\n- Scholarship rooted in tradition\n- Teaching that prepares students for public life\n- Service to the community" },
    { slug: "administration", title: "Administration", status: "published", summary: "Governance and leadership (demo).", body: "Replace with the college's governing body and administrative structure." },
  ], { onConflict: "slug" });
  const { count: heroCount } = await db.from("hero_slides").select("id", { count: "exact", head: true });
  if (!heroCount) await db.from("hero_slides").insert({ eyebrow: "Combine knowledge with character", title: "Noorul Hidaya College", subtitle: "Upload a real campus photograph in Admin → Website → Hero.", status: "published" });
  const { count: achCount } = await db.from("achievements").select("id", { count: "exact", head: true });
  if (!achCount) await db.from("achievements").insert([
    { figure: "25+", label: "Years of teaching", description: "Demo figure", sort_order: 1 }, { figure: "4", label: "Departments", description: "Demo figure", sort_order: 2 },
    { figure: "40", label: "Faculty members", description: "Demo figure", sort_order: 3 }, { figure: "900+", label: "Alumni", description: "Demo figure", sort_order: 4 },
  ]);
  await db.from("news").upsert({ title: "Academic year 2026-27 begins (demo)", slug: "academic-year-2026-27-begins-demo", excerpt: "Classes for the new academic year have commenced.", body: "This is a demonstration news item.", status: "published", published_at: new Date().toISOString(), created_by: admin }, { onConflict: "slug" });
  await db.from("events").upsert({ title: "Arabic Language Day seminar (demo)", slug: "arabic-language-day-seminar-demo", summary: "A one-day seminar organised by the Department of Arabic.", venue: "Seminar Hall", starts_at: new Date(Date.now() + 14 * 86400000).toISOString(), status: "published", created_by: admin }, { onConflict: "slug" });
  const { count: calCount } = await db.from("calendar_entries").select("id", { count: "exact", head: true });
  if (!calCount) await db.from("calendar_entries").insert([
    { title: "Odd semester classes begin", category: "term", starts_on: "2026-06-15" }, { title: "First internal assessment", category: "examination", starts_on: isoDay(25), ends_on: isoDay(30) },
    { title: "Semester fee due", category: "deadline", starts_on: isoDay(20) }, { title: "Onam holidays", category: "holiday", starts_on: "2026-08-25", ends_on: "2026-08-30" },
  ]);
  const { count: noticeCount } = await db.from("notices").select("id", { count: "exact", head: true });
  if (!noticeCount) await db.from("notices").insert({ title: "Welcome to the new academic year (demo)", body: "Students should check their timetable in the Student Portal.", audience: ["public", "student", "parent"], status: "published", created_by: supt });
  await db.from("letter_templates").upsert({ name: "General reply", subject: "Reply regarding your letter", body: "{{date}}\n\nDear {{recipient_name}},\n\nWith reference to your letter, we write to inform you that …\n\nYours faithfully,\n\n{{signatory}}\n{{college_name}}" }, { onConflict: "name" });

  console.log(`Done. Demo accounts use @${DOMAIN} and the SEED_PASSWORD you provided:`);
  console.log("  admin, superintendent, clerk, accountant, supervisor, teacher1-3, student1-6, parent1");
}

main().catch((e) => { console.error(e); process.exit(1); });
