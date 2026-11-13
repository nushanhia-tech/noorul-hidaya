# Architecture

## Principles

1. **One source of truth.** Every portal reads and writes the same normalised PostgreSQL schema. No portal has its own copy of student, faculty or financial data.
2. **Authorisation lives in the database.** Every table has row-level security (RLS), and the UI only hides what the database already refuses. Server Actions also check permissions so users get clear error messages.
3. **Business rules as constraints and triggers**: reference numbers, movement history, mark locking, payment limits, receipt issuance and notifications. They hold no matter which client writes the data.
4. **The service-role key is used only for what users cannot do themselves.** That means auth administration, signed URLs for private files, rate limiting, security logging, gateway confirmation and the daily job. It is used only after an explicit check and never reaches the browser.

## Request flow

```
Browser ──► proxy.ts (refresh session; /portal/* requires sign-in)
        ──► portal layout: requirePortal(<portal>) → verified user + roles + permissions (+ MFA rules)
        ──► Server Component queries with the user's session  → RLS filters rows
        ──► Server Action: Zod validation → assertPermission() → user-session write → RLS + triggers
```

Changing the URL cannot bypass a portal. Every portal layout calls `requirePortal`, and every query still goes through RLS.

## Schema (supabase/migrations)

| Area | Tables |
|---|---|
| Identity | `profiles` (1:1 auth.users), `user_roles`, `permissions`, `role_permissions`, `security_events`, `rate_limits` |
| Academic | `departments`, `programmes`, `courses`, `academic_years`, `terms`, `batches`, `students`, `faculty`, `parent_links`, `course_offerings`, `offering_faculty`, `enrolments`, `timetable_slots`, `exams`, `exam_sessions`, `mark_sheets`, `marks`, `results` (published snapshot), `study_resources` |
| Finance | `fee_heads`, `fee_structures`, `fee_structure_items`, `invoices`, `concessions`, `payments`, `receipts`, `refunds`, `payment_corrections`; views `invoice_balances`, `student_fee_balances` (security_invoker) |
| Office | `office_sections`, `staff_sections`, `office_files`, `file_movements`, `documents`, `office_tasks`, `task_comments`, `task_events`, `letters`, `letter_templates`, `tickets`, `ticket_messages`, `ticket_events`, `parent_threads`, `parent_messages` |
| Website | `site_settings`, `hero_slides`, `site_pages`, `leadership`, `achievements`, `news`, `events`, `gallery_items`, `calendar_entries`, `notices`, `contact_messages` |
| Notifications | `notifications` |

Reference numbers come from a concurrency-safe yearly counter, `next_reference()`. Formats: `FILE/2026/00001`, `INW/2026/0001`, `OUT/2026/0001`, `INV/2026/000001`, `RCPT/2026/000001`, `SANDBOX-RCPT/…`, `TKT-2026-0001`.

## Permission matrix (defaults — editable in Admin → Roles & Permissions)

| Permission | Admin | Clerk | Superintendent | Supervisor | Accountant |
|---|:-:|:-:|:-:|:-:|:-:|
| users.manage, roles.manage, academics.manage, cms.manage, settings.manage, reports.admin | ✓ | | | | |
| results.publish | ✓ | | | | |
| notices.publish | ✓ | | ✓ | | |
| students.lookup | ✓ | ✓ | ✓ | ✓ | ✓ |
| files.manage | | ✓ | ✓ | ✓ | |
| files.view_all, files.archive, tasks.assign, tasks.view_all, helpdesk.view_all, office.reports | | | ✓ | ✓ | (reports) |
| letters.view, letters.manage | | ✓ | ✓ | ✓ | |
| helpdesk.handle | | ✓ | ✓ | ✓ | ✓ |
| helpdesk.supervise (receives escalations) | | | | ✓ | |
| parents.respond | | ✓ | ✓ | ✓ | |
| finance.view | | | ✓ | ✓ | ✓ |
| finance.collect, finance.correct, finance.concessions, finance.structures | | | | | ✓ |

The following rules are fixed in the policies and cannot be changed through permissions:
- Students see only rows where `profile_id = auth.uid()`.
- Parents see a student only through a `parent_links` row with `status = 'active'`, which requires verification and recorded consent.
- Faculty see, and can enter marks for, only offerings in `offering_faculty`.
- Students never see raw `marks`, only published `results`.
- Office clerks see files they created, files assigned to them, and files in their own section.

Further rules enforced by column guards (triggers):
- Students can edit only their contact fields.
- Faculty can edit only their bio, qualification and specialisation.
- Payments are immutable except for audited corrections, and the payer amount never changes.
- Payments become verified only through collection or a verified gateway callback.
- Archived files are read-only.
- Only a task's creator or a supervisor can reassign it.
- The last administrator cannot be removed.

## Workflows

- **Marks:** faculty save a draft, then `submit_mark_sheet()` checks every enrolled student has marks and locks the sheet. The examination cell can return it with a note. `publish_exam_results()` requires a submitted sheet for every offering in the term, snapshots grades into `results`, and notifies students and verified parents.
- **Counter payment:** `record_counter_payment()` is atomic: it creates the payment and receipt together and is idempotent per form key. It never accepts more than the outstanding amount.
- **Online payment:** the server creates a gateway order and a *pending* payment. The Razorpay signature is verified server-side, at checkout and by the webhook. `confirm_online_payment()` is idempotent and rejects amount mismatches. No card data is ever handled.
- **Sandbox mode** (`PAYMENT_PROVIDER=sandbox`): clearly labelled test payments stored with `mode = 'sandbox'`. They are excluded from every total and get watermarked `SANDBOX-RCPT` receipts.
- **Refunds:** requested from a payment, approved or rejected by a *different* accountant, then marked processed with the bank reference.

## Notifications

Generated by database triggers on real events:
- notice published
- fee assigned or reminded
- receipt issued
- file, task or ticket assigned
- ticket reply or status change
- escalation
- letter dispatch status
- parent message
- mark sheet submitted or returned
- results published

A daily job, `/api/cron/daily`, sends task-deadline and fee-due reminders and, when Resend is configured, emails notifications to users who opted in.

## Documents and storage

- `public-media` (public bucket): website images and avatars. Writes require `cms.manage`, except avatars, which go through the server.
- `documents` (private bucket, **no client policies**): every upload is checked for size, declared type and magic bytes. Downloads go through `/api/documents/[id]` or `/api/resources/[id]`, which read the metadata row with the user's session (RLS decides via `can_access_entity`) and then redirect to a 60-second signed URL.

## Security checklist

- Server-side permission checks plus RLS on every table.
- Open-redirect-safe `next` handling.
- POST-only sign-out.
- Password policy enforced; re-authentication required to change a password.
- Optional or required TOTP MFA; AAL2 is enforced on portal layouts when a factor exists.
- DB-backed rate limits on login, password reset, MFA, contact form, ticket creation and payment start.
- Security events recorded: logins, failures, role and permission changes, deactivation, password and MFA changes, invalid payment signatures.
- Security headers (HSTS, frame denial, nosniff, referrer policy).
- CSV exports neutralise spreadsheet formulas.
