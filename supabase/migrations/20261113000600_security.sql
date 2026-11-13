-- =====================================================================
-- 0006 ROW LEVEL SECURITY, column guards, grants, default permissions
-- Every table has RLS enabled. Anything not explicitly allowed is denied.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permission catalogue + defaults
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, description) values
  ('users.manage',        'Administration', 'Create, edit and deactivate user accounts; link parents to students'),
  ('roles.manage',        'Administration', 'Assign roles and edit role permissions'),
  ('academics.manage',    'Administration', 'Departments, programmes, courses, terms, offerings, timetable and examinations'),
  ('cms.manage',          'Administration', 'Edit public website content'),
  ('settings.manage',     'Administration', 'Edit college settings and branding'),
  ('notices.publish',     'Administration', 'Publish notices and announcements'),
  ('results.publish',     'Examinations',   'Review mark sheets and publish official results'),
  ('reports.admin',       'Administration', 'View institution-wide reports and exports'),
  ('students.lookup',     'Office',         'Search student records'),
  ('files.manage',        'Office files',   'Create and process office files in own section'),
  ('files.view_all',      'Office files',   'View and process every office file'),
  ('files.archive',       'Office files',   'Archive and restore office files'),
  ('finance.view',        'Accounts',       'View fee ledgers, payments and financial reports'),
  ('finance.collect',     'Accounts',       'Collect fees, reconcile and request refunds'),
  ('finance.correct',     'Accounts',       'Correct or reverse payment records and decide refunds'),
  ('finance.concessions', 'Accounts',       'Grant and revoke fee concessions'),
  ('finance.structures',  'Accounts',       'Maintain fee structures and assign fees to students'),
  ('tasks.assign',        'Office tasks',   'Assign and reassign tasks to other staff'),
  ('tasks.view_all',      'Office tasks',   'View every office task'),
  ('letters.view',        'Correspondence', 'View inward and outward registers'),
  ('letters.manage',      'Correspondence', 'Register, compose and dispatch letters'),
  ('helpdesk.handle',     'Help desk',      'Handle and reply to help desk tickets'),
  ('helpdesk.view_all',   'Help desk',      'View and assign every help desk ticket'),
  ('helpdesk.supervise',  'Help desk',      'Receive escalated tickets'),
  ('parents.respond',     'Help desk',      'Read and reply to parent messages'),
  ('office.reports',      'Office',         'View office analytics and reports');

insert into public.role_permissions (role, permission_key) values
  ('admin','users.manage'),('admin','roles.manage'),('admin','academics.manage'),('admin','cms.manage'),
  ('admin','settings.manage'),('admin','notices.publish'),('admin','results.publish'),('admin','reports.admin'),
  ('admin','students.lookup'),
  ('office_clerk','files.manage'),('office_clerk','letters.view'),('office_clerk','letters.manage'),
  ('office_clerk','helpdesk.handle'),('office_clerk','students.lookup'),('office_clerk','parents.respond'),
  ('office_superintendent','files.manage'),('office_superintendent','files.view_all'),('office_superintendent','files.archive'),
  ('office_superintendent','tasks.assign'),('office_superintendent','tasks.view_all'),('office_superintendent','letters.view'),
  ('office_superintendent','letters.manage'),('office_superintendent','helpdesk.handle'),('office_superintendent','helpdesk.view_all'),
  ('office_superintendent','office.reports'),('office_superintendent','finance.view'),('office_superintendent','students.lookup'),
  ('office_superintendent','notices.publish'),('office_superintendent','parents.respond'),
  ('office_supervisor','files.manage'),('office_supervisor','files.view_all'),('office_supervisor','files.archive'),
  ('office_supervisor','tasks.assign'),('office_supervisor','tasks.view_all'),('office_supervisor','letters.view'),
  ('office_supervisor','letters.manage'),('office_supervisor','helpdesk.handle'),('office_supervisor','helpdesk.view_all'),
  ('office_supervisor','helpdesk.supervise'),('office_supervisor','office.reports'),('office_supervisor','finance.view'),
  ('office_supervisor','students.lookup'),('office_supervisor','parents.respond'),
  ('accountant','finance.view'),('accountant','finance.collect'),('accountant','finance.correct'),
  ('accountant','finance.concessions'),('accountant','finance.structures'),('accountant','students.lookup'),
  ('accountant','office.reports'),('accountant','helpdesk.handle');

-- ---------------------------------------------------------------------
-- Column guards (per-user column rules that grants cannot express)
-- ---------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service role / migrations
  if not public.has_permission('users.manage') then
    if new.id <> auth.uid() then raise exception 'Not authorised' using errcode = '42501'; end if;
    if new.full_name is distinct from old.full_name or new.email is distinct from old.email
       or new.is_active is distinct from old.is_active then
      raise exception 'Official account details can only be changed by the college office' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

create or replace function public.students_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_permission('users.manage') then return new; end if;
  if new.profile_id <> auth.uid() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if (new.register_no, coalesce(new.admission_no,''), new.programme_id, coalesce(new.batch_id::text,''), new.current_semester,
      new.status, coalesce(new.date_of_birth::text,''), coalesce(new.gender,''), coalesce(new.guardian_name,''), coalesce(new.admitted_on::text,''))
     is distinct from
     (old.register_no, coalesce(old.admission_no,''), old.programme_id, coalesce(old.batch_id::text,''), old.current_semester,
      old.status, coalesce(old.date_of_birth::text,''), coalesce(old.gender,''), coalesce(old.guardian_name,''), coalesce(old.admitted_on::text,'')) then
    raise exception 'Official academic records cannot be edited by students' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger students_guard before update on public.students for each row execute function public.students_guard();

create or replace function public.faculty_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_permission('users.manage') or public.has_permission('academics.manage') then return new; end if;
  if new.profile_id <> auth.uid() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if (new.employee_no, new.department_id, new.designation, new.is_hod, new.is_public, new.sort_order)
     is distinct from (old.employee_no, old.department_id, old.designation, old.is_hod, old.is_public, old.sort_order) then
    raise exception 'Official employment details cannot be edited here' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger faculty_guard before update on public.faculty for each row execute function public.faculty_guard();

create or replace function public.payments_guard_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.student_id, new.invoice_id, new.amount, new.mode, coalesce(new.provider,''), coalesce(new.provider_order_id,''), coalesce(new.idempotency_key,''))
     is distinct from
     (old.student_id, old.invoice_id, old.amount, old.mode, coalesce(old.provider,''), coalesce(old.provider_order_id,''), coalesce(old.idempotency_key,'')) then
    raise exception 'Payment amount, student, invoice and provider identifiers are immutable';
  end if;
  if auth.uid() is null then return new; end if;   -- server confirmation
  if (new.status, new.method, coalesce(new.reference_no,''), new.paid_at, coalesce(new.notes,''))
     is distinct from (old.status, old.method, coalesce(old.reference_no,''), old.paid_at, coalesce(old.notes,''))
     and not public.has_permission('finance.correct') then
    raise exception 'Only authorised accountants can correct payment records' using errcode = '42501';
  end if;
  if new.status = 'verified' and old.status <> 'verified' then
    raise exception 'Payments are verified only by collection or a verified gateway callback';
  end if;
  return new;
end $$;
create trigger payments_guard_update before update on public.payments for each row execute function public.payments_guard_update();

create or replace function public.office_files_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.status = 'archived') <> (old.status = 'archived') and not public.has_permission('files.archive') then
    raise exception 'Only authorised staff can archive or restore files' using errcode = '42501';
  end if;
  if old.status = 'archived' and new.status = 'archived' and row(new.*) is distinct from row(old.*) then
    raise exception 'Archived files are read-only. Restore the file first.';
  end if;
  return new;
end $$;
create trigger office_files_guard before update on public.office_files for each row execute function public.office_files_guard();

create or replace function public.office_tasks_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.assigned_to is distinct from old.assigned_to
     and not (public.has_permission('tasks.assign') or old.created_by = auth.uid()) then
    raise exception 'Only the task creator or a supervisor can reassign tasks' using errcode = '42501';
  end if;
  if (new.title, new.instructions, new.priority, coalesce(new.due_on::text,'')) is distinct from
     (old.title, old.instructions, old.priority, coalesce(old.due_on::text,''))
     and not (public.has_permission('tasks.assign') or old.created_by = auth.uid()) then
    raise exception 'Only the task creator or a supervisor can edit task details' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger office_tasks_guard before update on public.office_tasks for each row execute function public.office_tasks_guard();

-- ---------------------------------------------------------------------
-- Public faculty directory (safe columns only)
-- ---------------------------------------------------------------------
create view public.public_faculty_directory as
select f.id, p.full_name, f.designation, f.qualification, f.specialization, f.bio, f.photo_path,
       f.is_hod, f.sort_order, d.id as department_id, d.name as department_name, d.slug as department_slug
from public.faculty f
join public.profiles p on p.id = f.profile_id and p.is_active
join public.departments d on d.id = f.department_id and d.is_published
where f.is_public;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Core ------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated using (public.can_view_profile(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_permission('users.manage'))
  with check (id = auth.uid() or public.has_permission('users.manage'));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.manage') or public.has_permission('roles.manage'));
-- Office staff may see which users hold office roles (needed to assign work).
create policy user_roles_select_office on public.user_roles for select to authenticated
  using (public.is_office_staff() and role in ('office_clerk','office_superintendent','accountant','office_supervisor'));
create policy user_roles_insert on public.user_roles for insert to authenticated with check (public.has_permission('roles.manage'));
create policy user_roles_delete on public.user_roles for delete to authenticated using (public.has_permission('roles.manage'));

create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_insert on public.role_permissions for insert to authenticated with check (public.has_permission('roles.manage'));
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using (public.has_permission('roles.manage') and not (role = 'admin' and permission_key in ('roles.manage','users.manage')));

create policy site_settings_select on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_update on public.site_settings for update to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

-- Academic ----------------------------------------------------------------
create policy departments_select on public.departments for select to anon, authenticated
  using (is_published or public.has_permission('academics.manage'));
create policy departments_write on public.departments for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));

create policy programmes_select on public.programmes for select to anon, authenticated
  using (is_published or public.has_permission('academics.manage'));
create policy programmes_write on public.programmes for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));

create policy courses_select on public.courses for select to anon, authenticated using (is_active or public.has_permission('academics.manage'));
create policy courses_write on public.courses for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));

create policy academic_years_select on public.academic_years for select to authenticated using (true);
create policy academic_years_write on public.academic_years for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));
create policy terms_select on public.terms for select to authenticated using (true);
create policy terms_write on public.terms for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));
create policy batches_select on public.batches for select to authenticated using (true);
create policy batches_write on public.batches for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));

create policy students_select on public.students for select to authenticated using (
  profile_id = auth.uid() or public.parent_can_view_student(id) or public.faculty_teaches_student(id)
  or public.has_permission('students.lookup') or public.has_permission('users.manage'));
create policy students_insert on public.students for insert to authenticated with check (public.has_permission('users.manage'));
create policy students_update on public.students for update to authenticated
  using (profile_id = auth.uid() or public.has_permission('users.manage'))
  with check (profile_id = auth.uid() or public.has_permission('users.manage'));

create policy faculty_select on public.faculty for select to authenticated using (true);
create policy faculty_insert on public.faculty for insert to authenticated with check (public.has_permission('users.manage'));
create policy faculty_update on public.faculty for update to authenticated
  using (profile_id = auth.uid() or public.has_permission('users.manage') or public.has_permission('academics.manage'))
  with check (profile_id = auth.uid() or public.has_permission('users.manage') or public.has_permission('academics.manage'));

create policy parent_links_select on public.parent_links for select to authenticated using (
  parent_id = auth.uid() or student_id = public.current_student_id() or public.has_permission('users.manage'));
create policy parent_links_write on public.parent_links for all to authenticated
  using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));

create policy office_sections_select on public.office_sections for select to authenticated using (public.is_office_staff() or public.is_admin());
create policy office_sections_write on public.office_sections for all to authenticated
  using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));
create policy staff_sections_select on public.staff_sections for select to authenticated using (public.is_office_staff() or public.is_admin());
create policy staff_sections_write on public.staff_sections for all to authenticated
  using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));

create policy offerings_select on public.course_offerings for select to authenticated using (true);
create policy offerings_write on public.course_offerings for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));
create policy offering_faculty_select on public.offering_faculty for select to authenticated using (true);
create policy offering_faculty_write on public.offering_faculty for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));

create policy enrolments_select on public.enrolments for select to authenticated using (
  student_id = public.current_student_id() or public.faculty_teaches_offering(offering_id)
  or public.parent_can_view_student(student_id) or public.has_permission('academics.manage') or public.has_permission('students.lookup'));
create policy enrolments_write on public.enrolments for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));

create policy timetable_select on public.timetable_slots for select to authenticated using (true);
create policy timetable_write on public.timetable_slots for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));

create policy exams_select on public.exams for select to authenticated using (true);
create policy exams_write on public.exams for all to authenticated
  using (public.has_permission('academics.manage') or public.has_permission('results.publish'))
  with check (public.has_permission('academics.manage') or public.has_permission('results.publish'));
create policy exam_sessions_select on public.exam_sessions for select to authenticated using (true);
create policy exam_sessions_write on public.exam_sessions for all to authenticated
  using (public.has_permission('academics.manage')) with check (public.has_permission('academics.manage'));

create policy mark_sheets_select on public.mark_sheets for select to authenticated using (
  public.faculty_teaches_offering(offering_id) or public.has_permission('results.publish'));
create policy mark_sheets_insert on public.mark_sheets for insert to authenticated with check (
  (public.faculty_teaches_offering(offering_id) and status = 'draft') or public.has_permission('results.publish'));
create policy mark_sheets_update on public.mark_sheets for update to authenticated
  using ((public.faculty_teaches_offering(offering_id) and status <> 'submitted') or public.has_permission('results.publish'))
  with check ((public.faculty_teaches_offering(offering_id) and status <> 'submitted') or public.has_permission('results.publish'));

create policy marks_select on public.marks for select to authenticated using (exists (
  select 1 from public.mark_sheets ms where ms.id = mark_sheet_id
  and (public.faculty_teaches_offering(ms.offering_id) or public.has_permission('results.publish'))));
create policy marks_insert on public.marks for insert to authenticated with check (exists (
  select 1 from public.mark_sheets ms join public.enrolments e on e.offering_id = ms.offering_id and e.student_id = marks.student_id
  where ms.id = mark_sheet_id and public.faculty_teaches_offering(ms.offering_id)));
create policy marks_update on public.marks for update to authenticated
  using (exists (select 1 from public.mark_sheets ms where ms.id = mark_sheet_id and public.faculty_teaches_offering(ms.offering_id)))
  with check (exists (select 1 from public.mark_sheets ms where ms.id = mark_sheet_id and public.faculty_teaches_offering(ms.offering_id)));

create policy results_select on public.results for select to authenticated using (
  student_id = public.current_student_id() or public.parent_can_view_student(student_id)
  or public.faculty_teaches_offering(offering_id) or public.has_permission('results.publish') or public.has_permission('reports.admin'));

create policy study_resources_select on public.study_resources for select to authenticated using (
  (is_published and public.student_in_offering(offering_id)) or public.faculty_teaches_offering(offering_id)
  or public.has_permission('academics.manage'));
create policy study_resources_write on public.study_resources for all to authenticated
  using (public.faculty_teaches_offering(offering_id)) with check (public.faculty_teaches_offering(offering_id) and uploaded_by = auth.uid());

-- Finance -------------------------------------------------------------------
create policy fee_heads_select on public.fee_heads for select to authenticated using (true);
create policy fee_heads_write on public.fee_heads for all to authenticated
  using (public.has_permission('finance.structures')) with check (public.has_permission('finance.structures'));
create policy fee_structures_select on public.fee_structures for select to authenticated using (public.has_permission('finance.view'));
create policy fee_structures_write on public.fee_structures for all to authenticated
  using (public.has_permission('finance.structures')) with check (public.has_permission('finance.structures'));
create policy fee_items_select on public.fee_structure_items for select to authenticated using (public.has_permission('finance.view'));
create policy fee_items_write on public.fee_structure_items for all to authenticated
  using (public.has_permission('finance.structures')) with check (public.has_permission('finance.structures'));

create policy invoices_select on public.invoices for select to authenticated using (
  student_id = public.current_student_id() or public.parent_can_view_student(student_id) or public.has_permission('finance.view'));
create policy invoices_insert on public.invoices for insert to authenticated with check (public.has_permission('finance.structures'));
create policy invoices_update on public.invoices for update to authenticated
  using (public.has_permission('finance.correct')) with check (public.has_permission('finance.correct'));

create policy concessions_select on public.concessions for select to authenticated using (
  student_id = public.current_student_id() or public.parent_can_view_student(student_id) or public.has_permission('finance.view'));
create policy concessions_write on public.concessions for all to authenticated
  using (public.has_permission('finance.concessions')) with check (public.has_permission('finance.concessions'));

create policy payments_select on public.payments for select to authenticated using (
  student_id = public.current_student_id() or public.parent_can_view_student(student_id) or public.has_permission('finance.view'));
create policy payments_update on public.payments for update to authenticated
  using (public.has_permission('finance.collect') or public.has_permission('finance.correct'))
  with check (public.has_permission('finance.collect') or public.has_permission('finance.correct'));

create policy receipts_select on public.receipts for select to authenticated using (exists (
  select 1 from public.payments p where p.id = payment_id and (
    p.student_id = public.current_student_id() or public.parent_can_view_student(p.student_id) or public.has_permission('finance.view'))));

create policy refunds_select on public.refunds for select to authenticated using (
  student_id = public.current_student_id() or public.has_permission('finance.view'));
create policy refunds_insert on public.refunds for insert to authenticated with check (
  public.has_permission('finance.collect') and requested_by = auth.uid() and status = 'requested');
create policy refunds_update on public.refunds for update to authenticated
  using (public.has_permission('finance.correct')) with check (public.has_permission('finance.correct'));

create policy payment_corrections_select on public.payment_corrections for select to authenticated using (public.has_permission('finance.view'));
create policy payment_corrections_insert on public.payment_corrections for insert to authenticated with check (
  public.has_permission('finance.correct') and corrected_by = auth.uid());

-- Office ------------------------------------------------------------------------
create policy office_files_select on public.office_files for select to authenticated using (
  public.has_permission('files.view_all') or (public.has_permission('files.manage') and (
    created_by = auth.uid() or assigned_to = auth.uid()
    or section_id in (select ss.section_id from public.staff_sections ss where ss.user_id = auth.uid()))));
create policy office_files_insert on public.office_files for insert to authenticated with check (public.has_permission('files.manage'));
create policy office_files_update on public.office_files for update to authenticated
  using (public.can_access_office_file(id)) with check (public.has_permission('files.manage') or public.has_permission('files.view_all'));

create policy file_movements_select on public.file_movements for select to authenticated using (public.can_access_office_file(file_id));
create policy file_movements_insert on public.file_movements for insert to authenticated with check (
  public.can_access_office_file(file_id) and action in ('note','document_added') and actor_id = auth.uid());

create policy documents_select on public.documents for select to authenticated using (public.can_access_entity(entity_type, entity_id));
create policy documents_insert on public.documents for insert to authenticated with check (
  public.can_access_entity(entity_type, entity_id) and uploaded_by = auth.uid()
  and (entity_type <> 'letter' or public.has_permission('letters.manage')));
create policy documents_delete on public.documents for delete to authenticated using (
  uploaded_by = auth.uid() and public.can_access_entity(entity_type, entity_id));

create policy office_tasks_select on public.office_tasks for select to authenticated using (
  public.is_office_staff() and (assigned_to = auth.uid() or created_by = auth.uid() or public.has_permission('tasks.view_all')));
create policy office_tasks_insert on public.office_tasks for insert to authenticated with check (
  public.is_office_staff() and (assigned_to = auth.uid() or assigned_to is null or public.has_permission('tasks.assign')));
create policy office_tasks_update on public.office_tasks for update to authenticated
  using (public.can_access_task(id)) with check (public.is_office_staff());

create policy task_comments_select on public.task_comments for select to authenticated using (public.can_access_task(task_id));
create policy task_comments_insert on public.task_comments for insert to authenticated with check (
  public.can_access_task(task_id) and author_id = auth.uid());
create policy task_events_select on public.task_events for select to authenticated using (public.can_access_task(task_id));

create policy letter_templates_select on public.letter_templates for select to authenticated using (public.has_permission('letters.view'));
create policy letter_templates_write on public.letter_templates for all to authenticated
  using (public.has_permission('letters.manage')) with check (public.has_permission('letters.manage'));
create policy letters_select on public.letters for select to authenticated using (public.has_permission('letters.view'));
create policy letters_insert on public.letters for insert to authenticated with check (public.has_permission('letters.manage'));
create policy letters_update on public.letters for update to authenticated
  using (public.has_permission('letters.manage')) with check (public.has_permission('letters.manage'));

create policy tickets_select on public.tickets for select to authenticated using (
  requester_id = auth.uid() or public.has_permission('helpdesk.view_all')
  or (public.has_permission('helpdesk.handle') and (assigned_to = auth.uid() or escalated_to = auth.uid() or assigned_to is null)));
create policy tickets_insert on public.tickets for insert to authenticated with check (
  public.has_role('student') and requester_id = auth.uid());
create policy tickets_update on public.tickets for update to authenticated
  using (requester_id = auth.uid() or (public.has_permission('helpdesk.handle') and public.can_access_ticket(id)))
  with check (requester_id = auth.uid() or public.has_permission('helpdesk.handle'));

create policy ticket_messages_select on public.ticket_messages for select to authenticated using (
  public.can_access_ticket(ticket_id) and (not is_internal or public.has_permission('helpdesk.handle')));
create policy ticket_messages_insert on public.ticket_messages for insert to authenticated with check (
  author_id = auth.uid() and public.can_access_ticket(ticket_id)
  and (not is_internal or public.has_permission('helpdesk.handle'))
  and (public.has_permission('helpdesk.handle') or exists (select 1 from public.tickets t where t.id = ticket_id and t.status <> 'closed')));
create policy ticket_events_select on public.ticket_events for select to authenticated using (public.can_access_ticket(ticket_id));

create policy parent_threads_select on public.parent_threads for select to authenticated using (
  (parent_id = auth.uid() and public.parent_can_view_student(student_id)) or public.has_permission('parents.respond'));
create policy parent_threads_insert on public.parent_threads for insert to authenticated with check (
  parent_id = auth.uid() and public.parent_can_view_student(student_id));
create policy parent_threads_update on public.parent_threads for update to authenticated
  using (public.can_access_parent_thread(id)) with check (public.can_access_parent_thread(id));
create policy parent_messages_select on public.parent_messages for select to authenticated using (public.can_access_parent_thread(thread_id));
create policy parent_messages_insert on public.parent_messages for insert to authenticated with check (
  author_id = auth.uid() and public.can_access_parent_thread(thread_id)
  and exists (select 1 from public.parent_threads t where t.id = thread_id and t.status = 'open'));

-- Website content -------------------------------------------------------------
create policy hero_select on public.hero_slides for select to anon, authenticated using (status = 'published' or public.has_permission('cms.manage'));
create policy hero_write on public.hero_slides for all to authenticated using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
create policy pages_select on public.site_pages for select to anon, authenticated using (status = 'published' or public.has_permission('cms.manage'));
create policy pages_write on public.site_pages for all to authenticated using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
create policy leadership_select on public.leadership for select to anon, authenticated using (is_published or public.has_permission('cms.manage'));
create policy leadership_write on public.leadership for all to authenticated using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
create policy achievements_select on public.achievements for select to anon, authenticated using (is_published or public.has_permission('cms.manage'));
create policy achievements_write on public.achievements for all to authenticated using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
create policy news_select on public.news for select to anon, authenticated using ((status = 'published' and published_at <= now()) or public.has_permission('cms.manage'));
create policy news_write on public.news for all to authenticated using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
create policy events_select on public.events for select to anon, authenticated using (status = 'published' or public.has_permission('cms.manage'));
create policy events_write on public.events for all to authenticated using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
create policy gallery_select on public.gallery_items for select to anon, authenticated using (status = 'published' or public.has_permission('cms.manage'));
create policy gallery_write on public.gallery_items for all to authenticated using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
create policy calendar_select on public.calendar_entries for select to anon using (is_public);
create policy calendar_select_auth on public.calendar_entries for select to authenticated using (true);
create policy calendar_write on public.calendar_entries for all to authenticated
  using (public.has_permission('cms.manage') or public.has_permission('academics.manage'))
  with check (public.has_permission('cms.manage') or public.has_permission('academics.manage'));
create policy contact_select on public.contact_messages for select to authenticated using (public.has_permission('cms.manage'));
create policy contact_update on public.contact_messages for update to authenticated using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));

create policy notices_select_public on public.notices for select to anon using (
  status = 'published' and 'public' = any (audience) and (expires_on is null or expires_on >= current_date));
create policy notices_select_auth on public.notices for select to authenticated using (
  public.has_permission('notices.publish') or (status = 'published' and (
    'public' = any (audience)
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = any (audience))
    or ('office' = any (audience) and public.is_office_staff()))));
create policy notices_write on public.notices for all to authenticated
  using (public.has_permission('notices.publish')) with check (public.has_permission('notices.publish'));

create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- security_events, rate_limits, reference_counters: no policies (service role only)

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke all on public.security_events, public.rate_limits, public.reference_counters from anon, authenticated;
grant select on public.public_faculty_directory to anon, authenticated;

revoke execute on function public.next_reference(text, int) from anon, authenticated;
revoke execute on function public.rate_limit_hit(text, int, int) from anon, authenticated;
revoke execute on function public.confirm_online_payment(text, text, text, numeric) from anon, authenticated;
revoke execute on function public.notify(uuid, text, text, text, text) from anon, authenticated;
revoke execute on function public.run_daily_reminders() from anon, authenticated;
revoke execute on function public.users_with_permission(text) from anon, authenticated;
revoke execute on function public.record_counter_payment(uuid, numeric, text, text, timestamptz, text, text) from anon;
revoke execute on function public.publish_exam_results(uuid) from anon;
revoke execute on function public.submit_mark_sheet(uuid) from anon;
revoke execute on function public.return_mark_sheet(uuid, text) from anon;
revoke execute on function public.send_fee_reminder(uuid) from anon;
