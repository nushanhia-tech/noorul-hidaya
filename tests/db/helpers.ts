import { execFileSync } from "child_process";
import path from "path";
import { Pool, type PoolClient } from "pg";

/**
 * Database test harness. Recreates the test database from the migrations and
 * runs queries as a specific user by setting the JWT `sub` claim and the
 * `authenticated` role — exactly how PostgREST runs requests in Supabase.
 */
export const DB_URL = process.env.TEST_DATABASE_URL;
export const hasDb = Boolean(DB_URL);

let pool: Pool;

export async function setupDatabase() {
  execFileSync(path.join(__dirname, "../../scripts/db-apply-local.sh"), { env: { ...process.env }, stdio: "pipe" });
  pool = new Pool({ connectionString: DB_URL, max: 4 });
  return pool;
}

export async function teardown() {
  await pool?.end();
}

/** Run as superuser (bypasses RLS) — for fixtures. */
export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}

/** Run a callback as an authenticated user inside a transaction that is rolled back unless commit is true. */
export async function asUser<T>(uid: string | null, fn: (q: <R = Record<string, unknown>>(t: string, p?: unknown[]) => Promise<R[]>) => Promise<T>, commit = true): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    const out = await fn(async (t, p = []) => (await client.query(t, p)).rows);
    await client.query(commit ? "commit" : "rollback");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Expect a promise to be rejected by the database. Returns the error message. */
export async function rejects(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { return (e as Error).message; }
  throw new Error("Expected the database to reject the operation");
}

export async function createUser(name: string, roles: string[]): Promise<string> {
  const [u] = await sql<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [`${name.toLowerCase().replace(/\s+/g, ".")}.${Math.random().toString(36).slice(2, 7)}@example.test`, { full_name: name }]);
  for (const r of roles) await sql("insert into public.user_roles (user_id, role) values ($1, $2)", [u.id, r]);
  return u.id;
}

export type World = Awaited<ReturnType<typeof buildWorld>>;

/** A small fictional college used by every DB test. */
export async function buildWorld() {
  const admin = await createUser("Admin User", ["admin"]);
  const clerk = await createUser("Clerk One", ["office_clerk"]);
  const clerk2 = await createUser("Clerk Two", ["office_clerk"]);
  const superintendent = await createUser("Super Intendent", ["office_superintendent"]);
  const accountant = await createUser("Acc Ountant", ["accountant"]);
  const accountant2 = await createUser("Second Accountant", ["accountant"]);
  const supervisor = await createUser("Office Supervisor", ["office_supervisor"]);
  const facultyA = await createUser("Teacher Alpha", ["faculty"]);
  const facultyB = await createUser("Teacher Beta", ["faculty"]);
  const studentA = await createUser("Student Alpha", ["student"]);
  const studentB = await createUser("Student Beta", ["student"]);
  const parentA = await createUser("Parent Alpha", ["parent"]);
  const parentPending = await createUser("Parent Pending", ["parent"]);

  const [dept] = await sql<{ id: string }>("insert into departments (code, name, slug) values ('ARB','Arabic','arabic') returning id");
  const [prog] = await sql<{ id: string }>("insert into programmes (department_id, code, name, slug, level, duration_semesters) values ($1,'BA-ARB','BA Arabic','ba-arabic','UG',6) returning id", [dept.id]);
  const [year] = await sql<{ id: string }>("insert into academic_years (label, starts_on, ends_on, is_current) values ('2026-27','2026-06-01','2027-03-31',true) returning id");
  const [term] = await sql<{ id: string }>("insert into terms (academic_year_id, name, term_type, starts_on, ends_on, is_current) values ($1,'Odd 2026-27','odd','2026-06-01','2026-10-31',true) returning id", [year.id]);
  const [batch] = await sql<{ id: string }>("insert into batches (programme_id, name, start_year) values ($1,'BA Arabic 2026',2026) returning id", [prog.id]);
  const [c1] = await sql<{ id: string }>("insert into courses (department_id, programme_id, code, title, credits) values ($1,$2,'ARB101','Arabic Grammar I',4) returning id", [dept.id, prog.id]);
  const [c2] = await sql<{ id: string }>("insert into courses (department_id, programme_id, code, title, credits) values ($1,$2,'ARB102','Arabic Literature I',4) returning id", [dept.id, prog.id]);
  const [fA] = await sql<{ id: string }>("insert into faculty (profile_id, employee_no, department_id, designation) values ($1,'EMP1',$2,'Assistant Professor') returning id", [facultyA, dept.id]);
  const [fB] = await sql<{ id: string }>("insert into faculty (profile_id, employee_no, department_id, designation) values ($1,'EMP2',$2,'Assistant Professor') returning id", [facultyB, dept.id]);
  const [sA] = await sql<{ id: string }>("insert into students (profile_id, register_no, programme_id, batch_id) values ($1,'REG001',$2,$3) returning id", [studentA, prog.id, batch.id]);
  const [sB] = await sql<{ id: string }>("insert into students (profile_id, register_no, programme_id, batch_id) values ($1,'REG002',$2,$3) returning id", [studentB, prog.id, batch.id]);
  const [o1] = await sql<{ id: string }>("insert into course_offerings (course_id, term_id, batch_id, semester_number) values ($1,$2,$3,1) returning id", [c1.id, term.id, batch.id]);
  const [o2] = await sql<{ id: string }>("insert into course_offerings (course_id, term_id, batch_id, semester_number) values ($1,$2,$3,1) returning id", [c2.id, term.id, batch.id]);
  await sql("insert into offering_faculty (offering_id, faculty_id) values ($1,$2),($3,$4)", [o1.id, fA.id, o2.id, fB.id]);
  await sql("insert into enrolments (offering_id, student_id) values ($1,$3),($1,$4),($2,$3),($2,$4)", [o1.id, o2.id, sA.id, sB.id]);
  await sql("insert into parent_links (parent_id, student_id, relationship, status, consent_recorded, verified_at) values ($1,$2,'father','active',true,now())", [parentA, sA.id]);
  await sql("insert into parent_links (parent_id, student_id, relationship) values ($1,$2,'mother')", [parentPending, sA.id]);
  const [exam] = await sql<{ id: string }>("insert into exams (term_id, name, exam_type, max_marks, status) values ($1,'Internal 1','internal',50,'marks_entry') returning id", [term.id]);
  const [section] = await sql<{ id: string }>("insert into office_sections (name, code) values ('Academic Section','ACAD') returning id");
  const [section2] = await sql<{ id: string }>("insert into office_sections (name, code) values ('Accounts Section','ACCT') returning id");
  await sql("insert into staff_sections (user_id, section_id) values ($1,$2)", [clerk, section.id]);
  const [inv] = await sql<{ id: string }>("insert into invoices (invoice_no, student_id, title, amount, due_date) values ('',$1,'Semester 1 fees',10000,'2026-07-15') returning id", [sA.id]);
  const [invB] = await sql<{ id: string }>("insert into invoices (invoice_no, student_id, title, amount, due_date) values ('',$1,'Semester 1 fees',10000,'2026-07-15') returning id", [sB.id]);
  return {
    admin, clerk, clerk2, superintendent, accountant, accountant2, supervisor, facultyA, facultyB, studentA, studentB, parentA, parentPending,
    dept: dept.id, prog: prog.id, term: term.id, batch: batch.id, studentAId: sA.id, studentBId: sB.id, o1: o1.id, o2: o2.id, exam: exam.id,
    section: section.id, section2: section2.id, invoiceA: inv.id, invoiceB: invB.id,
  };
}
