# Administrator guide

## First day

1. **Settings** (Admin → Settings): college name, short name, motto, logo, contact details, affiliation. Choose which homepage sections to show. Decide whether to require two-step verification for administrators, accountants and office supervisors (recommended).
2. **Two-step verification for yourself** (Account settings → Security): scan the QR code with an authenticator app.
3. **Academic setup** (Admin → Academic Setup): create the academic year and mark it current, then the odd/even terms (mark the current one), then the batches.
4. **Departments, programmes and courses** (Admin → Departments; Admin → Programmes & Courses).
5. **Office sections** are seeded by the demo script. For a live system, create the sections you need (e.g. Academic, Accounts, Establishment) through the SQL editor or the seed script, then assign staff to them when creating users.

## Accounts

Admin → Users → **New user**. Choose the roles; extra fields appear for students (register number, programme, batch) and faculty (employee number, department, designation).

- **Invitation (recommended):** the person sets their own password from the email link.
- **Temporary password:** share it securely and ask the person to change it in Account settings.
- **Parents:** create the parent account, open it, and add a *linked student* by register number. Tick the verification box only after checking the relationship and, for adult students, recording the student's consent. Pending links share nothing.
- **Deactivating** an account blocks sign-in immediately. Administrators never see passwords; use *Send password reset link* instead.

## Teaching and examinations

1. Admin → Offerings & Timetable → **New offering** (course + batch + term + teacher). The batch's active students are enrolled automatically.
2. Add weekly classes to each offering. They appear on student and faculty timetables.
3. Admin → Examinations → create the exam, schedule papers, then **Open marks entry**.
4. Teachers enter and submit marks. You can **return** a sheet with a note.
5. When every sheet is submitted, **Publish results**. Students and verified parents are notified. Published results cannot be edited.

## Website

Admin → Website. Hero, pages, news, events, gallery, achievements, leadership and calendar each have draft/published states. Use **Preview** for drafts. Upload real campus photographs; the homepage shows a neutral illustration until you do.

## Notices

Admin → Notices (and Office → Notices for superintendents). Choose the audiences. Publishing sends an in-app notification to every member of the audience; *Public* notices also appear on the website.

## Permissions

Admin → Roles & Permissions lists every permission per office role. Changes take effect immediately, including in database access rules. Keep at least one administrator with `users.manage` and `roles.manage` (the system enforces this).

## Certificates

Certificate requests arrive in the Office help desk. Certificates are prepared and signed manually by the office; the system tracks the request but does not generate certificates.
