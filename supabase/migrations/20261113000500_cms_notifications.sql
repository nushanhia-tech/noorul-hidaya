-- =====================================================================
-- 0005 WEBSITE CONTENT, NOTICES, NOTIFICATIONS
-- =====================================================================

create table public.hero_slides (
  id          uuid primary key default gen_random_uuid(),
  eyebrow     text not null default '',
  title       text not null,
  subtitle    text not null default '',
  image_path  text,
  image_alt   text not null default '',
  sort_order  int not null default 0,
  status      text not null default 'draft' check (status in ('draft','published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger hero_slides_updated before update on public.hero_slides for each row execute function public.set_updated_at();

create table public.site_pages (
  slug        text primary key check (slug ~ '^[a-z0-9-]+$'),
  title       text not null,
  summary     text not null default '',
  body        text not null default '',
  image_path  text,
  status      text not null default 'draft' check (status in ('draft','published')),
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create trigger site_pages_updated before update on public.site_pages for each row execute function public.set_updated_at();

create table public.leadership (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  designation text not null,
  message     text not null default '',
  photo_path  text,
  sort_order  int not null default 0,
  is_published boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.achievements (
  id          uuid primary key default gen_random_uuid(),
  figure      text not null,
  label       text not null,
  description text not null default '',
  sort_order  int not null default 0,
  is_published boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.news (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 4 and 200),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  excerpt      text not null default '',
  body         text not null default '',
  cover_path   text,
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index news_published_idx on public.news (published_at desc) where status = 'published';
create trigger news_updated before update on public.news for each row execute function public.set_updated_at();

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  summary     text not null default '',
  description text not null default '',
  venue       text not null default '',
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  cover_path  text,
  status      text not null default 'draft' check (status in ('draft','published')),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_starts_idx on public.events (starts_at) where status = 'published';
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();

create table public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  caption     text not null default '',
  album       text not null default 'Campus',
  image_path  text not null,
  sort_order  int not null default 0,
  status      text not null default 'published' check (status in ('draft','published')),
  created_at  timestamptz not null default now()
);

create table public.calendar_entries (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  category    text not null check (category in ('term','examination','holiday','event','deadline','result')),
  starts_on   date not null,
  ends_on     date,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index calendar_entries_starts_idx on public.calendar_entries (starts_on);

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 120),
  email      citext not null,
  phone      text,
  subject    text not null check (char_length(subject) between 3 and 200),
  message    text not null check (char_length(message) between 10 and 5000),
  status     text not null default 'new' check (status in ('new','read','replied','archived')),
  created_at timestamptz not null default now()
);

-- Notices -------------------------------------------------------------
create table public.notices (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 4 and 200),
  body         text not null default '',
  category     text not null default 'general' check (category in ('general','academic','examination','administrative','fee','event')),
  audience     text[] not null default '{public}' check (audience <@ array['public','student','faculty','parent','office']::text[] and cardinality(audience) > 0),
  is_important boolean not null default false,
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  expires_on   date,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index notices_published_idx on public.notices (published_at desc) where status = 'published';
create trigger notices_updated before update on public.notices for each row execute function public.set_updated_at();

-- Notifications ----------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in ('notice','result','fee_reminder','payment','file_assigned','task_assigned','task_deadline','ticket_response','ticket_status','ticket_assigned','letter_dispatch','announcement','parent_message','marks')),
  title      text not null,
  body       text not null default '',
  link       text check (link is null or link ~ '^/'),
  read_at    timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_email_idx on public.notifications (created_at) where emailed_at is null;

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p_user, p_type, p_title, coalesce(p_body, ''), p_link
  where p_user is not null and exists (select 1 from public.profiles where id = p_user and is_active);
$$;
revoke all on function public.notify(uuid, text, text, text, text) from public;

-- Portal path for a role
create or replace function public.portal_for_role(r public.app_role)
returns text language sql immutable as $$
  select case r when 'student' then '/portal/student' when 'faculty' then '/portal/faculty'
    when 'parent' then '/portal/parent' when 'admin' then '/portal/admin' else '/portal/office' end;
$$;

-- ---------------------------------------------------------------------
-- Event-driven notification triggers
-- ---------------------------------------------------------------------

-- Notice published → each user in the audience
create or replace function public.notice_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;
create trigger notices_publish before insert or update on public.notices for each row execute function public.notice_notify();

create or replace function public.notice_notify_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    insert into public.notifications (user_id, type, title, body, link)
    select distinct ur.user_id,
      case when new.is_important then 'announcement' else 'notice' end,
      new.title, left(new.body, 240),
      public.portal_for_role(min(ur.role)) || '/notices'
    from public.user_roles ur join public.profiles p on p.id = ur.user_id and p.is_active
    where (ur.role::text = any (new.audience))
       or ('office' = any (new.audience) and ur.role in ('office_clerk','office_superintendent','accountant','office_supervisor'))
    group by ur.user_id;
  end if;
  return new;
end $$;
create trigger notices_publish_after after insert or update on public.notices for each row execute function public.notice_notify_after();

-- Fee assigned (invoice) → student and linked parents
create or replace function public.invoice_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  select profile_id into v_profile from public.students where id = new.student_id;
  perform public.notify(v_profile, 'fee_reminder', 'New fee assigned: ' || new.title,
    'Amount ' || to_char(new.amount, 'FM99,99,99,990.00') || ', due ' || to_char(new.due_date, 'DD Mon YYYY'), '/portal/student/fees');
  perform public.notify(pl.parent_id, 'fee_reminder', 'New fee assigned: ' || new.title,
    'Amount ' || to_char(new.amount, 'FM99,99,99,990.00') || ', due ' || to_char(new.due_date, 'DD Mon YYYY'), '/portal/parent/fees')
  from public.parent_links pl where pl.student_id = new.student_id and pl.status = 'active';
  return new;
end $$;
create trigger invoices_notify after insert on public.invoices for each row execute function public.invoice_notify();

-- Receipt issued → payment confirmation
create or replace function public.receipt_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_profile uuid; v_amount numeric; v_mode text; v_student uuid;
begin
  select s.profile_id, p.amount, p.mode, p.student_id into v_profile, v_amount, v_mode, v_student
  from public.payments p join public.students s on s.id = p.student_id where p.id = new.payment_id;
  perform public.notify(v_profile, 'payment',
    case when v_mode = 'sandbox' then 'Sandbox test payment recorded (not a real payment)' else 'Payment received' end,
    'Receipt ' || new.receipt_no || ' for ' || to_char(v_amount, 'FM99,99,99,990.00'), '/portal/student/fees');
  if v_mode = 'live' then
    perform public.notify(pl.parent_id, 'payment', 'Payment received', 'Receipt ' || new.receipt_no || ' for ' || to_char(v_amount, 'FM99,99,99,990.00'), '/portal/parent/fees')
    from public.parent_links pl where pl.student_id = v_student and pl.status = 'active';
  end if;
  return new;
end $$;
create trigger receipts_notify after insert on public.receipts for each row execute function public.receipt_notify();

-- Office file assigned
create or replace function public.office_file_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform public.notify(new.assigned_to, 'file_assigned', 'File assigned: ' || new.reference_no, new.subject, '/portal/office/files/' || new.id);
  end if;
  return new;
end $$;
create trigger office_files_notify after insert or update on public.office_files for each row execute function public.office_file_notify();

-- Task assigned
create or replace function public.office_task_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform public.notify(new.assigned_to, 'task_assigned', 'New task: ' || new.title,
      coalesce('Due ' || to_char(new.due_on, 'DD Mon YYYY'), 'No deadline'), '/portal/office/tasks/' || new.id);
  end if;
  return new;
end $$;
create trigger office_tasks_notify after insert or update on public.office_tasks for each row execute function public.office_task_notify();

-- Ticket status / assignment / escalation
create or replace function public.ticket_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.requester_id is distinct from auth.uid() then
    perform public.notify(new.requester_id, 'ticket_status', 'Request ' || new.ticket_no || ' updated',
      'Status changed to ' || replace(new.status, '_', ' '), '/portal/student/helpdesk/' || new.id);
  end if;
  if new.assigned_to is not null and new.assigned_to is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform public.notify(new.assigned_to, 'ticket_assigned', 'Ticket assigned: ' || new.ticket_no, new.subject, '/portal/office/helpdesk/' || new.id);
  end if;
  if tg_op = 'UPDATE' and new.escalated_to is not null and new.escalated_to is distinct from old.escalated_to then
    perform public.notify(new.escalated_to, 'ticket_assigned', 'Ticket escalated: ' || new.ticket_no, new.subject, '/portal/office/helpdesk/' || new.id);
  end if;
  if tg_op = 'INSERT' and new.assigned_to is null then
    -- let help-desk handlers know a new request arrived
    perform public.notify(u, 'ticket_assigned', 'New help desk request ' || new.ticket_no, new.subject, '/portal/office/helpdesk/' || new.id)
    from public.users_with_permission('helpdesk.view_all') u;
  end if;
  return new;
end $$;
create trigger tickets_notify after insert or update on public.tickets for each row execute function public.ticket_notify();

create or replace function public.ticket_message_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = new.ticket_id;
  if new.is_internal then return new; end if;
  if new.author_id is distinct from t.requester_id then
    perform public.notify(t.requester_id, 'ticket_response', 'New reply on ' || t.ticket_no, left(new.body, 200), '/portal/student/helpdesk/' || t.id);
  elsif t.assigned_to is not null then
    perform public.notify(t.assigned_to, 'ticket_response', 'Student replied on ' || t.ticket_no, left(new.body, 200), '/portal/office/helpdesk/' || t.id);
  end if;
  return new;
end $$;
create trigger ticket_messages_notify after insert on public.ticket_messages for each row execute function public.ticket_message_notify();

-- Letter dispatch status
create or replace function public.letter_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'outward' and new.status is distinct from old.status and new.created_by is distinct from auth.uid() then
    perform public.notify(new.created_by, 'letter_dispatch', 'Letter ' || new.reference_no || ' ' || new.status,
      new.subject, '/portal/office/correspondence/' || new.id);
  end if;
  return new;
end $$;
create trigger letters_notify after update on public.letters for each row execute function public.letter_notify();

-- Parent thread replies
create or replace function public.parent_message_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.parent_threads;
begin
  select * into t from public.parent_threads where id = new.thread_id;
  if new.author_id is distinct from t.parent_id then
    perform public.notify(t.parent_id, 'parent_message', 'Reply from the college office', left(new.body, 200), '/portal/parent/messages/' || t.id);
  else
    perform public.notify(u, 'parent_message', 'Parent message: ' || t.subject, left(new.body, 200), '/portal/office/parents/' || t.id)
    from public.users_with_permission('parents.respond') u;
  end if;
  return new;
end $$;
create trigger parent_messages_notify after insert on public.parent_messages for each row execute function public.parent_message_notify();

-- Mark sheet submitted → result publishers
create or replace function public.mark_sheet_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'submitted' and old.status <> 'submitted' then
    perform public.notify(u, 'marks', 'Marks submitted', 'A mark sheet is ready for review.', '/portal/admin/exams/' || new.exam_id)
    from public.users_with_permission('results.publish') u;
  elsif new.status = 'returned' and old.status = 'submitted' then
    perform public.notify(new.submitted_by, 'marks', 'Mark sheet returned for correction', coalesce(new.return_note, ''), '/portal/faculty/marks');
  end if;
  return new;
end $$;
create trigger mark_sheets_notify after update on public.mark_sheets for each row execute function public.mark_sheet_notify();

-- ---------------------------------------------------------------------
-- Workflow RPCs
-- ---------------------------------------------------------------------

-- Faculty submit a mark sheet (locks it)
create or replace function public.submit_mark_sheet(p_sheet uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.mark_sheets; v_missing int;
begin
  select * into s from public.mark_sheets where id = p_sheet for update;
  if s.id is null then raise exception 'Mark sheet not found'; end if;
  if not public.faculty_teaches_offering(s.offering_id) then raise exception 'Not authorised' using errcode = '42501'; end if;
  if s.status = 'submitted' then return; end if;
  select count(*) into v_missing from public.enrolments e
    left join public.marks m on m.mark_sheet_id = s.id and m.student_id = e.student_id
    where e.offering_id = s.offering_id and (m.id is null or (m.marks is null and not m.is_absent));
  if v_missing > 0 then raise exception '% student(s) still have no marks entered', v_missing; end if;
  update public.mark_sheets set status = 'submitted', submitted_by = auth.uid(), submitted_at = now(), return_note = null where id = s.id;
end $$;

create or replace function public.return_mark_sheet(p_sheet uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('results.publish') then raise exception 'Not authorised' using errcode = '42501'; end if;
  update public.mark_sheets set status = 'returned', return_note = p_note where id = p_sheet and status = 'submitted';
end $$;

-- Publish results for an exam: snapshot marks into results, notify.
create or replace function public.publish_exam_results(p_exam uuid)
returns int language plpgsql security definer set search_path = public as $$
declare e public.exams; v_pending int; v_count int;
begin
  if not public.has_permission('results.publish') then raise exception 'Not authorised to publish results' using errcode = '42501'; end if;
  select * into e from public.exams where id = p_exam for update;
  if e.id is null then raise exception 'Exam not found'; end if;
  if e.status = 'published' then raise exception 'Results already published'; end if;
  -- Every course offered in the exam's term that has students must have a submitted sheet.
  select count(*) into v_pending from public.course_offerings o
    where o.term_id = e.term_id
      and exists (select 1 from public.enrolments en where en.offering_id = o.id)
      and not exists (select 1 from public.mark_sheets ms where ms.exam_id = p_exam and ms.offering_id = o.id and ms.status = 'submitted');
  if v_pending > 0 then raise exception '% mark sheet(s) are not yet submitted', v_pending; end if;
  if not exists (select 1 from public.mark_sheets where exam_id = p_exam) then raise exception 'No mark sheets to publish'; end if;

  insert into public.results (exam_id, offering_id, student_id, course_code, course_title, credits, marks, max_marks,
                              percentage, grade, grade_point, passed, is_absent, semester_number)
  select e.id, ms.offering_id, m.student_id, c.code, c.title, c.credits, m.marks, e.max_marks,
         round(m.marks * 100 / e.max_marks, 2), g.grade, g.grade_point, g.grade <> 'F', m.is_absent, o.semester_number
  from public.mark_sheets ms
  join public.marks m on m.mark_sheet_id = ms.id
  join public.course_offerings o on o.id = ms.offering_id
  join public.courses c on c.id = o.course_id
  cross join lateral public.grade_for(case when m.is_absent then null else round(m.marks * 100 / e.max_marks, 2) end, e.pass_percent) g
  where ms.exam_id = e.id;
  get diagnostics v_count = row_count;

  update public.exams set status = 'published', published_at = now(), published_by = auth.uid() where id = e.id;

  perform public.notify(s.profile_id, 'result', 'Results published: ' || e.name, 'Your results are now available.', '/portal/student/results')
  from (select distinct student_id from public.results where exam_id = e.id) r join public.students s on s.id = r.student_id;
  perform public.notify(pl.parent_id, 'result', 'Results published: ' || e.name, 'Results for your ward are now available.', '/portal/parent/results')
  from (select distinct student_id from public.results where exam_id = e.id) r
  join public.parent_links pl on pl.student_id = r.student_id and pl.status = 'active';
  return v_count;
end $$;

-- Daily job: task deadline + fee reminders (called by the cron route
-- with the service role). Returns counts.
create or replace function public.run_daily_reminders()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tasks int := 0; v_fees int := 0;
begin
  with due as (
    update public.office_tasks set deadline_notified_on = current_date
    where status in ('todo','in_progress','waiting') and due_on is not null and due_on <= current_date + 1
      and assigned_to is not null and (deadline_notified_on is null or deadline_notified_on < current_date)
    returning *
  )
  select count(*) into v_tasks from (
    select public.notify(assigned_to, 'task_deadline',
      case when due_on < current_date then 'Overdue task: ' else 'Task due soon: ' end || title,
      'Due ' || to_char(due_on, 'DD Mon YYYY'), '/portal/office/tasks/' || id) from due) x;

  with reminders as (
    update public.invoices i set last_reminded_at = now()
    from public.invoice_balances b
    where b.invoice_id = i.id and b.outstanding > 0 and i.cancelled_at is null
      and i.due_date <= current_date + 7
      and (i.last_reminded_at is null or i.last_reminded_at < now() - interval '7 days')
    returning i.*, b.outstanding
  )
  select count(*) into v_fees from (
    select public.notify(s.profile_id, 'fee_reminder',
      case when r.due_date < current_date then 'Fee overdue: ' else 'Fee due soon: ' end || r.title,
      'Outstanding ' || to_char(r.outstanding, 'FM99,99,99,990.00') || ', due ' || to_char(r.due_date, 'DD Mon YYYY'), '/portal/student/fees')
    from reminders r join public.students s on s.id = r.student_id) x;

  return jsonb_build_object('task_reminders', v_tasks, 'fee_reminders', v_fees);
end $$;
revoke all on function public.run_daily_reminders() from public;

-- Manual fee reminder for one invoice (accounts staff)
create or replace function public.send_fee_reminder(p_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b public.invoice_balances; v_profile uuid;
begin
  if not public.has_permission('finance.view') then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into b from public.invoice_balances where invoice_id = p_invoice;
  if b.outstanding <= 0 then raise exception 'Nothing outstanding on this invoice'; end if;
  select profile_id into v_profile from public.students where id = b.student_id;
  perform public.notify(v_profile, 'fee_reminder', 'Fee reminder: ' || b.title,
    'Outstanding ' || to_char(b.outstanding, 'FM99,99,99,990.00') || ', due ' || to_char(b.due_date, 'DD Mon YYYY'), '/portal/student/fees');
  perform public.notify(pl.parent_id, 'fee_reminder', 'Fee reminder: ' || b.title,
    'Outstanding ' || to_char(b.outstanding, 'FM99,99,99,990.00') || ', due ' || to_char(b.due_date, 'DD Mon YYYY'), '/portal/parent/fees')
  from public.parent_links pl where pl.student_id = b.student_id and pl.status = 'active';
  update public.invoices set last_reminded_at = now() where id = p_invoice;
end $$;
