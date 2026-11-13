# College Management System

A complete college website with five secure portals: **Student**, **Faculty**, **Parent**, **Admin** and **Office**. They all share one PostgreSQL database (Supabase), and every portal is protected by row-level security.

- **Public website**: homepage, about, mission & vision, administration, departments, faculty directory, programmes, academic calendar, news & notices, events, gallery, contact and search. Everything is editable in Admin → Website.
- **One login for every portal**: role-based redirects, a role picker for multi-role accounts, password reset, optional TOTP two-step verification (can be required for privileged roles), and rate limiting.
- **Student Portal**: dashboard, profile (contact details editable, official identifiers locked), timetable, published results with PDF statements, study materials, fees & receipts with online payment, help desk and notifications.
- **Faculty Portal**: dashboard, profile, teaching timetable, courses with class lists, marks entry (draft → submit → lock), academic progress charts, reports with CSV export, teaching resources and notices.
- **Parent Portal**: verified and consented links only. Shows the linked student's profile, published results, fees, notices and messages with the office.
- **Admin Portal**: users, roles & fine-grained permissions, departments, programmes & courses, academic years/terms/batches, offerings & timetable, examinations and result publication, website CMS (with draft preview), notices, contact messages, reports and settings.
- **Office Portal**, with all six modules:
  1. Paperless file management: reference numbers, assignment, forwarding between sections, movement history, notes, documents, archive
  2. Fees & accounts: structures, ledgers, counter collection, receipts, outstanding fees, concessions, refunds, corrections, reconciliation, reports
  3. Staff tasks: list and Kanban views, assignment, comments, history, deadline reminders
  4. Official letters: inward and outward registers, templates, dispatch tracking, acknowledgement, printable letters
  5. Reports & analytics: financial, file, task, correspondence and help desk reports, each with PDF and CSV
  6. Student help desk: assignment, replies, internal notes, requests for information, escalation, response-time tracking

**Removed by design** (these do not exist anywhere in the app): admission, library, placement and alumni portals; attendance of any kind; leave; assignment submission; automatic certificate generation; a principal approval module; QR certificate verification; and an audit-log dashboard. Essential security events are still recorded in `security_events`.

## Tech stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (PostgreSQL, Auth, Storage, RLS) · Zod · React Hook Form · Recharts · pdf-lib · Lucide icons · Vitest · Playwright.

## Project layout

```
supabase/migrations/   SQL schema, triggers, workflow functions, RLS policies, storage buckets
supabase/tests/        Supabase stand-in used only by the local DB test-suite
src/proxy.ts           Session refresh + gate for /portal/* (Next 16 "proxy", formerly middleware)
src/lib/auth/          Roles, permissions, session & authorisation guards
src/lib/               Fees, grades, uploads, payments adapter, PDF builder, CSV, storage, security
src/app/(public)/      Public website
src/app/portal/<p>/    The five portals (+ /portal/account for every user)
src/app/api/           Downloads (documents, receipts, PDFs, CSV), payment webhook, daily cron
src/components/        Design system (ui/), website (site/), portal shell (portal/)
scripts/               seed.ts (fictional demo data), create-admin.ts, db-apply-local.sh
tests/unit, tests/db, tests/e2e
docs/                  Architecture, deployment, administrator guide, backup & restore
```

## Getting started (local development)

1. **Create a Supabase project** at https://supabase.com (free tier is fine for development).
2. **Apply the database migrations.** Use either option:
   - Supabase CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`
   - SQL editor: run each file in `supabase/migrations/` **in filename order**.
3. **Configure the environment:** `cp .env.example .env.local` and fill in the Supabase URL, anon key and service-role key.
4. **Supabase Auth settings** (Dashboard → Authentication):
   - URL configuration: set **Site URL** to your site and add `https://<your-site>/auth/confirm` to the redirect URLs.
   - Turn off public sign-ups. Accounts are created only by administrators.
   - Turn on MFA (TOTP) if you want two-step verification.
5. Install and run:
   ```bash
   npm install
   ```
   ```bash
   npm run dev
   ```
6. **Create the first administrator.** They receive an invitation email and choose their own password:
   ```bash
   npm run create-admin -- --email you@yourcollege.edu --name "Your Name"
   ```
7. (Optional) **Load the fictional demo college.** This creates fictional data only, never run it on a live project. Demo accounts use `@demo.college.test`.
   ```bash
   SEED_PASSWORD='Choose-A-Strong-1' npm run seed -- --yes
   ```

## Testing

```bash
npm run typecheck
```
```bash
npm run lint
```
```bash
npm test
```
`npm test` runs the unit tests: fees, grades, uploads, auth routing, CSV, payment signatures.

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:54329/college_test npm run test:db
```
The database suite runs the real migrations on a local PostgreSQL 16 and checks access rules and workflows as different users. It covers student data isolation, parent link restrictions, faculty marks permissions, result publication, office files, fee calculations and duplicate-payment handling, task assignment, correspondence, the help desk workflow, notifications, document permissions and anonymous access. The target database is dropped and recreated each run.

```bash
npm run build && npm run test:e2e
```
The Playwright end-to-end suite covers the public pages, responsive navigation, route protection and login form behaviour at desktop and mobile sizes. Authenticated workflows also run when `E2E_SUPABASE=1` and `SEED_PASSWORD` point at a seeded project.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel. In short: import the GitHub repository in Vercel, add the variables from `.env.example`, deploy, then set the Supabase redirect URLs to the production domain.

## Further documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): schema, permission matrix, security model, notifications, payments
- [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md): first-time setup for the college office
- [docs/BACKUP_AND_RESTORE.md](docs/BACKUP_AND_RESTORE.md): backup and restore procedure
- [docs/PROGRESS.md](docs/PROGRESS.md): what is implemented and what still needs configuring
