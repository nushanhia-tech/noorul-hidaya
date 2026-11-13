import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, buildWorld, hasDb, rejects, setupDatabase, sql, teardown, type World } from "./helpers";

/**
 * These tests run the real migrations against PostgreSQL and exercise row-level
 * security, triggers and workflow functions as different users.
 * Requires TEST_DATABASE_URL (see README → Testing).
 */
const d = hasDb ? describe : describe.skip;
let w: World;

beforeAll(async () => {
  if (!hasDb) return;
  await setupDatabase();
  w = await buildWorld();
}, 120000);
afterAll(async () => { if (hasDb) await teardown(); });

d("student data isolation", () => {
  it("a student sees only their own student record, invoices and payments", async () => {
    await asUser(w.studentA, async (q) => {
      const students = await q<{ id: string }>("select id from students");
      expect(students.map((s) => s.id)).toEqual([w.studentAId]);
      const inv = await q<{ id: string }>("select id from invoices");
      expect(inv.map((i) => i.id)).toEqual([w.invoiceA]);
      expect(await q("select * from invoice_balances where student_id = $1", [w.studentBId])).toHaveLength(0);
    });
  });

  it("students cannot read raw marks or other students' results", async () => {
    await asUser(w.studentB, async (q) => {
      expect(await q("select * from marks")).toHaveLength(0);
      expect(await q("select * from results where student_id = $1", [w.studentAId])).toHaveLength(0);
    });
  });

  it("students cannot change official identifiers", async () => {
    const msg = await rejects(asUser(w.studentA, (q) => q("update students set register_no = 'HACK' where id = $1", [w.studentAId])));
    expect(msg).toMatch(/cannot be edited/);
    await asUser(w.studentA, (q) => q("update students set address = 'New address' where id = $1", [w.studentAId]));
    const [s] = await sql<{ address: string }>("select address from students where id = $1", [w.studentAId]);
    expect(s.address).toBe("New address");
  });

  it("students cannot grant themselves roles", async () => {
    const msg = await rejects(asUser(w.studentA, (q) => q("insert into user_roles (user_id, role) values ($1, 'admin')", [w.studentA])));
    expect(msg).toMatch(/row-level security/);
  });
});

d("parent access restrictions", () => {
  it("an active, verified link gives access to that student only", async () => {
    await asUser(w.parentA, async (q) => {
      const s = await q<{ id: string }>("select id from students");
      expect(s.map((x) => x.id)).toEqual([w.studentAId]);
      expect(await q("select * from invoices where student_id = $1", [w.studentBId])).toHaveLength(0);
    });
  });

  it("a pending (unverified) link gives no access", async () => {
    await asUser(w.parentPending, async (q) => {
      expect(await q("select * from students")).toHaveLength(0);
      expect(await q("select * from invoices")).toHaveLength(0);
    });
  });

  it("a link cannot be activated without verification and consent", async () => {
    const msg = await rejects(sql("update parent_links set status = 'active' where parent_id = $1", [w.parentPending]));
    expect(msg).toMatch(/check constraint/);
  });
});

d("faculty marks permissions", () => {
  let sheet: string;
  it("assigned faculty can create a sheet and enter marks", async () => {
    await asUser(w.facultyA, async (q) => {
      const [s] = await q<{ id: string }>("insert into mark_sheets (exam_id, offering_id) values ($1, $2) returning id", [w.exam, w.o1]);
      sheet = s.id;
      await q("insert into marks (mark_sheet_id, student_id, marks) values ($1, $2, 42), ($1, $3, 18)", [sheet, w.studentAId, w.studentBId]);
    });
    expect(await sql("select * from marks where mark_sheet_id = $1", [sheet])).toHaveLength(2);
  });

  it("faculty cannot enter marks for a course they are not assigned to", async () => {
    const msg = await rejects(asUser(w.facultyA, (q) => q("insert into mark_sheets (exam_id, offering_id) values ($1, $2)", [w.exam, w.o2])));
    expect(msg).toMatch(/row-level security/);
    await asUser(w.facultyB, async (q) => expect(await q("select * from marks where mark_sheet_id = $1", [sheet])).toHaveLength(0));
  });

  it("marks above the maximum are rejected", async () => {
    const msg = await rejects(asUser(w.facultyA, (q) => q("update marks set marks = 51 where mark_sheet_id = $1", [sheet])));
    expect(msg).toMatch(/exceed the maximum/);
  });

  it("submitting locks the sheet and faculty cannot self-publish", async () => {
    await asUser(w.facultyA, (q) => q("select submit_mark_sheet($1)", [sheet]));
    const msg = await rejects(asUser(w.facultyA, (q) => q("update marks set marks = 49 where mark_sheet_id = $1", [sheet])));
    expect(msg).toMatch(/submitted and is locked/);
    const pub = await rejects(asUser(w.facultyA, (q) => q("select publish_exam_results($1)", [w.exam])));
    expect(pub).toMatch(/Not authorised/);
  });

  it("publishing requires every sheet submitted, then snapshots results and notifies students and parents", async () => {
    const pending = await rejects(asUser(w.admin, (q) => q("select publish_exam_results($1)", [w.exam])));
    expect(pending).toMatch(/not yet submitted|No mark sheets/);
    // Teacher B completes their sheet.
    await asUser(w.facultyB, async (q) => {
      const [s] = await q<{ id: string }>("insert into mark_sheets (exam_id, offering_id) values ($1, $2) returning id", [w.exam, w.o2]);
      await q("insert into marks (mark_sheet_id, student_id, marks, is_absent) values ($1, $2, 30, false), ($1, $3, null, true)", [s.id, w.studentAId, w.studentBId]);
      await q("select submit_mark_sheet($1)", [s.id]);
    });
    const [{ publish_exam_results: n }] = await asUser(w.admin, (q) => q<{ publish_exam_results: number }>("select publish_exam_results($1)", [w.exam]));
    expect(n).toBe(4);
    await asUser(w.studentA, async (q) => {
      const r = await q<{ grade: string; course_code: string }>("select grade, course_code from results order by course_code");
      expect(r).toEqual([{ grade: "A+", course_code: "ARB101" }, { grade: "B+", course_code: "ARB102" }]);
    });
    const [absent] = await sql<{ grade: string; passed: boolean }>("select grade, passed from results where student_id = $1 and course_code = 'ARB102'", [w.studentBId]);
    expect(absent).toEqual({ grade: "F", passed: false });
    const notes = await sql<{ user_id: string }>("select user_id from notifications where type = 'result'");
    expect(notes.map((x) => x.user_id)).toEqual(expect.arrayContaining([w.studentA, w.studentB, w.parentA]));
    expect(notes.map((x) => x.user_id)).not.toContain(w.parentPending);
  });
});

d("office files", () => {
  let fileId: string;
  it("creating a file generates a reference number and a movement record", async () => {
    const [f] = await asUser(w.clerk, (q) => q<{ id: string; reference_no: string; status: string }>(
      "insert into office_files (subject, category, section_id, assigned_to) values ('Bonafide request', 'student_record', $1, $2) returning id, reference_no, status", [w.section, w.clerk2]));
    fileId = f.id;
    expect(f.reference_no).toMatch(/^FILE\/\d{4}\/\d{5}$/);
    expect(f.status).toBe("assigned");
    const moves = await sql<{ action: string }>("select action from file_movements where file_id = $1", [fileId]);
    expect(moves.map((m) => m.action)).toEqual(["created"]);
    const n = await sql("select * from notifications where user_id = $1 and type = 'file_assigned'", [w.clerk2]);
    expect(n).toHaveLength(1);
  });

  it("status changes and forwarding are recorded in the movement history", async () => {
    await asUser(w.clerk, (q) => q("update office_files set status = 'in_progress' where id = $1", [fileId]));
    await asUser(w.superintendent, (q) => q("update office_files set section_id = $2 where id = $1", [fileId, w.section2]));
    const moves = await sql<{ action: string; from_status: string | null; to_status: string | null }>("select action, from_status, to_status from file_movements where file_id = $1 order by id", [fileId]);
    expect(moves.map((m) => m.action)).toEqual(["created", "status_changed", "forwarded"]);
    expect(moves[1]).toMatchObject({ from_status: "assigned", to_status: "in_progress" });
  });

  it("record-level access: unrelated clerks cannot see the file; students never can", async () => {
    const other = await sql<{ id: string }>("insert into auth.users (email) values ('clerk3@example.test') returning id");
    await sql("insert into user_roles (user_id, role) values ($1, 'office_clerk')", [other[0].id]);
    await asUser(other[0].id, async (q) => expect(await q("select * from office_files")).toHaveLength(0));
    await asUser(w.studentA, async (q) => expect(await q("select * from office_files")).toHaveLength(0));
    await asUser(w.supervisor, async (q) => expect(await q("select * from office_files where id = $1", [fileId])).toHaveLength(1));
  });

  it("only staff with files.archive can archive, and archived files are read-only", async () => {
    await asUser(w.clerk, (q) => q("update office_files set status = 'completed' where id = $1", [fileId]));
    const msg = await rejects(asUser(w.clerk, (q) => q("update office_files set status = 'archived' where id = $1", [fileId])));
    expect(msg).toMatch(/archive/);
    await asUser(w.superintendent, (q) => q("update office_files set status = 'archived' where id = $1", [fileId]));
    const ro = await rejects(asUser(w.superintendent, (q) => q("update office_files set subject = 'changed' where id = $1", [fileId])));
    expect(ro).toMatch(/read-only/);
  });
});

d("fees and payments", () => {
  it("counter payments update the balance and issue a receipt", async () => {
    const [{ record_counter_payment: pid }] = await asUser(w.accountant, (q) => q<{ record_counter_payment: string }>(
      "select record_counter_payment($1, 4000, 'cash', '', now(), '', 'key-1')", [w.invoiceA]));
    const [b] = await sql<{ outstanding: string; status: string }>("select outstanding, status from invoice_balances where invoice_id = $1", [w.invoiceA]);
    expect(Number(b.outstanding)).toBe(6000);
    expect(b.status).toBe("partially_paid");
    const [r] = await sql<{ receipt_no: string }>("select receipt_no from receipts where payment_id = $1", [pid]);
    expect(r.receipt_no).toMatch(/^RCPT\/\d{4}\/\d{6}$/);
  });

  it("duplicate submissions with the same idempotency key do not double-charge", async () => {
    const [a] = await asUser(w.accountant, (q) => q<{ record_counter_payment: string }>("select record_counter_payment($1, 1000, 'cash', '', now(), '', 'dup-key')", [w.invoiceA]));
    const [b] = await asUser(w.accountant, (q) => q<{ record_counter_payment: string }>("select record_counter_payment($1, 1000, 'cash', '', now(), '', 'dup-key')", [w.invoiceA]));
    expect(a.record_counter_payment).toBe(b.record_counter_payment);
    const [bal] = await sql<{ outstanding: string }>("select outstanding from invoice_balances where invoice_id = $1", [w.invoiceA]);
    expect(Number(bal.outstanding)).toBe(5000);
  });

  it("over-payment and non-accountant collection are rejected", async () => {
    expect(await rejects(asUser(w.accountant, (q) => q("select record_counter_payment($1, 999999, 'cash', '', now(), '', 'big')", [w.invoiceA])))).toMatch(/exceeds outstanding/);
    expect(await rejects(asUser(w.clerk, (q) => q("select record_counter_payment($1, 10, 'cash', '', now(), '', 'clerk')", [w.invoiceA])))).toMatch(/Not authorised/);
    expect(await rejects(asUser(w.accountant, (q) => q("select record_counter_payment($1, 10, 'upi', '', now(), '', 'noref')", [w.invoiceA])))).toMatch(/reference is required/);
  });

  it("concessions reduce the balance; sandbox payments never count", async () => {
    await asUser(w.accountant, (q) => q("insert into concessions (invoice_id, student_id, amount, category, reason) values ($1, $2, 500, 'merit', 'Merit scholarship')", [w.invoiceA, w.studentAId]));
    await sql("insert into payments (student_id, invoice_id, amount, method, mode, status, provider, provider_order_id, paid_at) values ($1, $2, 4500, 'online', 'sandbox', 'pending', 'sandbox', 'sb_1', null)", [w.studentAId, w.invoiceA]);
    await sql("select confirm_online_payment('sandbox', 'sb_1', 'sb_pay_1', 4500)");
    const [b] = await sql<{ outstanding: string }>("select outstanding from invoice_balances where invoice_id = $1", [w.invoiceA]);
    expect(Number(b.outstanding)).toBe(4500);
    const [r] = await sql<{ receipt_no: string }>("select r.receipt_no from receipts r join payments p on p.id = r.payment_id where p.provider_order_id = 'sb_1'");
    expect(r.receipt_no).toMatch(/^SANDBOX-RCPT/);
  });

  it("gateway confirmation is idempotent and rejects amount mismatches", async () => {
    await sql("insert into payments (student_id, invoice_id, amount, method, mode, status, provider, provider_order_id) values ($1, $2, 100, 'online', 'live', 'pending', 'razorpay', 'order_1')", [w.studentBId, w.invoiceB]);
    const [a] = await sql<{ confirm_online_payment: string }>("select confirm_online_payment('razorpay', 'order_1', 'pay_1', 100)");
    const [b] = await sql<{ confirm_online_payment: string }>("select confirm_online_payment('razorpay', 'order_1', 'pay_1', 100)");
    expect(a.confirm_online_payment).toBe(b.confirm_online_payment);
    expect(await sql("select * from receipts where payment_id = $1", [a.confirm_online_payment])).toHaveLength(1);
    await sql("insert into payments (student_id, invoice_id, amount, method, mode, status, provider, provider_order_id) values ($1, $2, 100, 'online', 'live', 'pending', 'razorpay', 'order_2')", [w.studentBId, w.invoiceB]);
    expect(await rejects(sql("select confirm_online_payment('razorpay', 'order_2', 'pay_2', 99)"))).toMatch(/Amount mismatch/);
  });

  it("only finance.correct can reverse; payments cannot be marked verified by hand", async () => {
    const [p] = await sql<{ id: string }>("select id from payments where idempotency_key = 'key-1'");
    // RLS silently filters the update for a role without finance.collect/correct: nothing changes.
    await asUser(w.superintendent, (q) => q("update payments set status = 'reversed' where id = $1", [p.id]));
    expect((await sql<{ status: string }>("select status from payments where id = $1", [p.id]))[0].status).toBe("verified");
    await asUser(w.accountant, (q) => q("update payments set status = 'reversed' where id = $1", [p.id]));
    const [b] = await sql<{ outstanding: string }>("select outstanding from invoice_balances where invoice_id = $1", [w.invoiceA]);
    expect(Number(b.outstanding)).toBe(8500);
    const [pending] = await sql<{ id: string }>("select id from payments where provider_order_id = 'order_2'");
    expect(await rejects(asUser(w.accountant, (q) => q("update payments set status = 'verified', paid_at = now() where id = $1", [pending.id])))).toMatch(/verified only by collection/);
  });
});

d("office tasks", () => {
  it("clerks can create tasks only for themselves; supervisors can assign; assignee is notified", async () => {
    expect(await rejects(asUser(w.clerk, (q) => q("insert into office_tasks (title, assigned_to) values ('Not allowed', $1)", [w.clerk2])))).toMatch(/row-level security/);
    await asUser(w.clerk, (q) => q("insert into office_tasks (title, assigned_to) values ('My own task', $1)", [w.clerk]));
    const [t] = await asUser(w.superintendent, (q) => q<{ id: string }>("insert into office_tasks (title, assigned_to, due_on) values ('Prepare TC files', $1, current_date) returning id", [w.clerk]));
    expect(await sql("select * from notifications where user_id = $1 and type = 'task_assigned'", [w.clerk])).toHaveLength(1);
    // The assignee can progress the task but not reassign it.
    await asUser(w.clerk, (q) => q("update office_tasks set status = 'completed' where id = $1", [t.id]));
    expect(await rejects(asUser(w.clerk, (q) => q("update office_tasks set assigned_to = $2 where id = $1", [t.id, w.clerk2])))).toMatch(/reassign/);
    const events = await sql<{ to_status: string }>("select to_status from task_events where task_id = $1 order by id", [t.id]);
    expect(events.map((e) => e.to_status)).toEqual(["todo", "completed"]);
    const [done] = await sql<{ completed_at: string | null }>("select completed_at from office_tasks where id = $1", [t.id]);
    expect(done.completed_at).not.toBeNull();
  });
});

d("correspondence", () => {
  it("registers inward/outward letters with separate reference series and hides them from students", async () => {
    const [i] = await asUser(w.clerk, (q) => q<{ reference_no: string }>("insert into letters (direction, subject, sender_name, letter_date, received_on, status) values ('inward', 'University circular', 'University', current_date, current_date, 'received') returning reference_no"));
    const [o] = await asUser(w.clerk, (q) => q<{ reference_no: string }>("insert into letters (direction, subject, recipient_name, letter_date, status) values ('outward', 'Reply to circular', 'Registrar', current_date, 'draft') returning reference_no"));
    expect(i.reference_no).toMatch(/^INW\/\d{4}\/\d{4}$/);
    expect(o.reference_no).toMatch(/^OUT\/\d{4}\/\d{4}$/);
    await asUser(w.studentA, async (q) => expect(await q("select * from letters")).toHaveLength(0));
    expect(await rejects(asUser(w.clerk, (q) => q("insert into letters (direction, subject, letter_date, status) values ('inward', 'No sender', current_date, 'received')")))).toMatch(/check constraint/);
  });
});

d("help desk workflow", () => {
  let ticket: string;
  it("a student opens a ticket; handlers are notified", async () => {
    const [t] = await asUser(w.studentA, (q) => q<{ id: string; ticket_no: string; status: string }>(
      "insert into tickets (requester_id, category, subject, description) values ($1, 'certificate_request', 'Bonafide certificate', 'Needed for a scholarship application.') returning id, ticket_no, status", [w.studentA]));
    ticket = t.id;
    expect(t.ticket_no).toMatch(/^TKT-\d{4}-\d{4}$/);
    expect(t.status).toBe("open");
    expect(await sql("select * from notifications where user_id = $1 and type = 'ticket_assigned'", [w.superintendent])).toHaveLength(1);
  });

  it("staff replies set first response, internal notes stay hidden, student is notified", async () => {
    await asUser(w.clerk, (q) => q("update tickets set assigned_to = $2 where id = $1", [ticket, w.clerk]));
    await asUser(w.clerk, (q) => q("insert into ticket_messages (ticket_id, author_id, body) values ($1, $2, 'Please collect on Friday.')", [ticket, w.clerk]));
    await asUser(w.clerk, (q) => q("insert into ticket_messages (ticket_id, author_id, body, is_internal) values ($1, $2, 'Principal signature pending', true)", [ticket, w.clerk]));
    const [t] = await sql<{ status: string; first_response_at: string | null }>("select status, first_response_at from tickets where id = $1", [ticket]);
    expect(t.status).toBe("in_progress");
    expect(t.first_response_at).not.toBeNull();
    await asUser(w.studentA, async (q) => {
      const msgs = await q<{ body: string }>("select body from ticket_messages where ticket_id = $1", [ticket]);
      expect(msgs.map((m) => m.body)).toEqual(["Please collect on Friday."]);
    });
    expect(await sql("select * from notifications where user_id = $1 and type = 'ticket_response'", [w.studentA])).toHaveLength(1);
  });

  it("students cannot see others' tickets or change priority; they can close a resolved ticket", async () => {
    await asUser(w.studentB, async (q) => expect(await q("select * from tickets")).toHaveLength(0));
    expect(await rejects(asUser(w.studentA, (q) => q("update tickets set priority = 'urgent' where id = $1", [ticket])))).toMatch(/only reopen or close/);
    await asUser(w.clerk, (q) => q("update tickets set status = 'resolved' where id = $1", [ticket]));
    await asUser(w.studentA, (q) => q("update tickets set status = 'closed' where id = $1", [ticket]));
    const [t] = await sql<{ status: string; closed_at: string | null }>("select status, closed_at from tickets where id = $1", [ticket]);
    expect(t.status).toBe("closed");
    expect(t.closed_at).not.toBeNull();
  });
});

d("notifications and documents", () => {
  it("publishing a notice notifies its audience only", async () => {
    await asUser(w.admin, (q) => q("insert into notices (title, body, audience, status) values ('Exam timetable released', 'See the portal.', '{student}', 'published')"));
    const rows = await sql<{ user_id: string }>("select user_id from notifications where title = 'Exam timetable released'");
    expect(rows.map((r) => r.user_id).sort()).toEqual([w.studentA, w.studentB].sort());
  });

  it("users can only read and mark their own notifications", async () => {
    await asUser(w.studentB, async (q) => {
      expect((await q<{ user_id: string }>("select user_id from notifications")).every((n) => n.user_id === w.studentB)).toBe(true);
    });
    expect(await rejects(asUser(w.studentA, (q) => q("update notifications set title = 'x'")))).toMatch(/permission denied/);
  });

  it("document metadata follows the access rules of its parent record", async () => {
    const [f] = await asUser(w.clerk, (q) => q<{ id: string }>("insert into office_files (subject, category, section_id) values ('Private file', 'general', $1) returning id", [w.section]));
    await asUser(w.clerk, (q) => q("insert into documents (entity_type, entity_id, storage_path, file_name, mime_type, size_bytes, uploaded_by) values ('office_file', $1, 'office_file/x/doc.pdf', 'doc.pdf', 'application/pdf', 100, $2)", [f.id, w.clerk]));
    await asUser(w.studentA, async (q) => expect(await q("select * from documents where entity_id = $1", [f.id])).toHaveLength(0));
    expect(await rejects(asUser(w.studentA, (q) => q("insert into documents (entity_type, entity_id, storage_path, file_name, mime_type, size_bytes, uploaded_by) values ('office_file', $1, 'y.pdf', 'y.pdf', 'application/pdf', 1, $2)", [f.id, w.studentA])))).toMatch(/row-level security/);
    expect(await rejects(asUser(w.clerk, (q) => q("insert into documents (entity_type, entity_id, storage_path, file_name, mime_type, size_bytes, uploaded_by) values ('office_file', $1, 'z.exe', 'z.exe', 'application/x-msdownload', 1, $2)", [f.id, w.clerk])))).toMatch(/check constraint/);
  });

  it("the anonymous public sees published content only", async () => {
    await sql("insert into news (title, slug, status) values ('Draft story', 'draft-story', 'draft'), ('Live story', 'live-story', 'published')");
    await sql("update news set published_at = now() - interval '1 minute' where slug = 'live-story'");
    await asUser(null, async (q) => {
      const n = await q<{ slug: string }>("select slug from news");
      expect(n.map((x) => x.slug)).toEqual(["live-story"]);
      expect(await q("select * from students")).toHaveLength(0);
      expect(await q("select * from contact_messages")).toHaveLength(0);
    });
  });
});
