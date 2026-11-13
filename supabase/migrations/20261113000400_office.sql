-- =====================================================================
-- 0004 OFFICE: files, documents, tasks, correspondence, help desk,
-- parent communication
-- =====================================================================

-- Paperless file management -------------------------------------------
create table public.office_files (
  id            uuid primary key default gen_random_uuid(),
  reference_no  text not null unique,
  subject       text not null check (char_length(subject) between 3 and 200),
  description   text not null default '',
  category      text not null check (category in ('student_record','academic','examination','finance','establishment','general','legal','correspondence')),
  priority      text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status        text not null default 'new' check (status in ('new','assigned','in_progress','waiting_info','completed','archived')),
  student_id    uuid references public.students (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  section_id    uuid references public.office_sections (id) on delete set null,
  assigned_to   uuid references public.profiles (id) on delete set null,
  due_date      date,
  created_by    uuid references public.profiles (id) on delete set null,
  completed_at  timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((status = 'archived') = (archived_at is not null))
);
create index office_files_status_idx on public.office_files (status);
create index office_files_assigned_idx on public.office_files (assigned_to) where status <> 'archived';
create index office_files_section_idx on public.office_files (section_id);
create index office_files_student_idx on public.office_files (student_id);
create index office_files_search_idx on public.office_files using gin (to_tsvector('simple', reference_no || ' ' || subject || ' ' || description));
create trigger office_files_updated before update on public.office_files for each row execute function public.set_updated_at();

create table public.file_movements (
  id           bigint generated always as identity primary key,
  file_id      uuid not null references public.office_files (id) on delete cascade,
  action       text not null check (action in ('created','assigned','forwarded','status_changed','note','document_added','archived','restored','updated')),
  from_section uuid references public.office_sections (id) on delete set null,
  to_section   uuid references public.office_sections (id) on delete set null,
  from_user    uuid references public.profiles (id) on delete set null,
  to_user      uuid references public.profiles (id) on delete set null,
  from_status  text,
  to_status    text,
  note         text,
  actor_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index file_movements_file_idx on public.file_movements (file_id, created_at);

create or replace function public.office_file_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.reference_no := public.next_reference('FILE', 5);
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.assigned_to is not null and new.status = 'new' then new.status := 'assigned'; end if;
  end if;
  if new.status = 'archived' and new.archived_at is null then new.archived_at := now(); end if;
  if new.status <> 'archived' then new.archived_at := null; end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then new.completed_at := now(); end if;
  return new;
end $$;
create trigger office_files_before before insert or update on public.office_files for each row execute function public.office_file_before();

-- Movement history is written automatically for every meaningful change.
create or replace function public.office_file_track()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.file_movements (file_id, action, to_section, to_user, to_status, actor_id, note)
    values (new.id, 'created', new.section_id, new.assigned_to, new.status, auth.uid(), null);
    return new;
  end if;
  if new.section_id is distinct from old.section_id then
    insert into public.file_movements (file_id, action, from_section, to_section, from_user, to_user, actor_id, note)
    values (new.id, 'forwarded', old.section_id, new.section_id, old.assigned_to, new.assigned_to, auth.uid(), current_setting('app.movement_note', true));
  elsif new.assigned_to is distinct from old.assigned_to then
    insert into public.file_movements (file_id, action, from_user, to_user, actor_id, note)
    values (new.id, 'assigned', old.assigned_to, new.assigned_to, auth.uid(), current_setting('app.movement_note', true));
  end if;
  if new.status is distinct from old.status then
    insert into public.file_movements (file_id, action, from_status, to_status, actor_id, note)
    values (new.id, case when new.status = 'archived' then 'archived' when old.status = 'archived' then 'restored' else 'status_changed' end,
            old.status, new.status, auth.uid(), current_setting('app.movement_note', true));
  end if;
  return new;
end $$;
create trigger office_files_track after insert or update on public.office_files for each row execute function public.office_file_track();

-- Generic private document metadata (bytes live in Supabase Storage,
-- private bucket "documents"). Access mirrors the parent record.
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('office_file','ticket','letter','task','parent_thread')),
  entity_id    uuid not null,
  category     text not null default 'supporting' check (category in ('supporting','application','certificate_copy','id_proof','correspondence','report','other')),
  storage_path text not null unique,
  file_name    text not null,
  mime_type    text not null check (mime_type in (
                 'application/pdf',
                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 'image/png','image/jpeg','image/webp')),
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index documents_entity_idx on public.documents (entity_type, entity_id);

-- Office tasks ---------------------------------------------------------
create table public.office_tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 3 and 200),
  instructions text not null default '',
  priority     text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status       text not null default 'todo' check (status in ('todo','in_progress','waiting','completed','cancelled')),
  due_on       date,
  assigned_to  uuid references public.profiles (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  file_id      uuid references public.office_files (id) on delete set null,
  ticket_id    uuid,   -- fk added after tickets table
  completed_at timestamptz,
  deadline_notified_on date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index office_tasks_assigned_idx on public.office_tasks (assigned_to, status);
create index office_tasks_due_idx on public.office_tasks (due_on) where status in ('todo','in_progress','waiting');
create trigger office_tasks_updated before update on public.office_tasks for each row execute function public.set_updated_at();

create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.office_tasks (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

create table public.task_events (
  id            bigint generated always as identity primary key,
  task_id       uuid not null references public.office_tasks (id) on delete cascade,
  actor_id      uuid references public.profiles (id) on delete set null,
  from_status   text, to_status text,
  from_assignee uuid references public.profiles (id) on delete set null,
  to_assignee   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index task_events_task_idx on public.task_events (task_id, created_at);

create or replace function public.office_task_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then new.completed_at := now(); end if;
  if new.status <> 'completed' then new.completed_at := null; end if;
  if tg_op = 'UPDATE' and new.due_on is distinct from old.due_on then new.deadline_notified_on := null; end if;
  return new;
end $$;
create trigger office_tasks_before before insert or update on public.office_tasks for each row execute function public.office_task_before();

create or replace function public.office_task_track()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_events (task_id, actor_id, to_status, to_assignee) values (new.id, auth.uid(), new.status, new.assigned_to);
  elsif new.status is distinct from old.status or new.assigned_to is distinct from old.assigned_to then
    insert into public.task_events (task_id, actor_id, from_status, to_status, from_assignee, to_assignee)
    values (new.id, auth.uid(), old.status, new.status, old.assigned_to, new.assigned_to);
  end if;
  return new;
end $$;
create trigger office_tasks_track after insert or update on public.office_tasks for each row execute function public.office_task_track();

-- Correspondence -------------------------------------------------------
create table public.letter_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  subject    text not null,
  body       text not null,
  is_active  boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger letter_templates_updated before update on public.letter_templates for each row execute function public.set_updated_at();

create table public.letters (
  id               uuid primary key default gen_random_uuid(),
  reference_no     text not null unique,
  direction        text not null check (direction in ('inward','outward')),
  external_ref     text,                -- the sender's own letter number (inward)
  subject          text not null check (char_length(subject) between 3 and 250),
  description      text not null default '',
  body             text,                -- full text for letters composed here
  template_id      uuid references public.letter_templates (id) on delete set null,
  sender_name      text,
  sender_address   text,
  recipient_name   text,
  recipient_address text,
  letter_date      date not null,
  received_on      date,
  dispatched_on    date,
  department_id    uuid references public.departments (id) on delete set null,
  mode             text check (mode in ('post','registered_post','speed_post','courier','email','hand_delivery','fax')),
  tracking_no      text,
  status           text not null check (status in ('received','under_action','closed','draft','ready','dispatched','delivered','returned')),
  acknowledged_at  timestamptz,
  acknowledgement_note text,
  file_id          uuid references public.office_files (id) on delete set null,
  archived_at      timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((direction = 'inward' and status in ('received','under_action','closed') and sender_name is not null and received_on is not null)
      or (direction = 'outward' and status in ('draft','ready','dispatched','delivered','returned') and recipient_name is not null)),
  check (status not in ('dispatched','delivered','returned') or dispatched_on is not null)
);
create index letters_direction_idx on public.letters (direction, letter_date desc);
create index letters_file_idx on public.letters (file_id);
create index letters_search_idx on public.letters using gin (to_tsvector('simple', reference_no || ' ' || subject || ' ' || coalesce(sender_name,'') || ' ' || coalesce(recipient_name,'')));
create trigger letters_updated before update on public.letters for each row execute function public.set_updated_at();

create or replace function public.letter_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.reference_no := public.next_reference(case when new.direction = 'inward' then 'INW' else 'OUT' end, 4);
    new.created_by := coalesce(new.created_by, auth.uid());
  elsif new.direction <> old.direction then
    raise exception 'Letter direction cannot be changed';
  end if;
  return new;
end $$;
create trigger letters_before before insert or update on public.letters for each row execute function public.letter_before();

-- Help desk -------------------------------------------------------------
create table public.tickets (
  id               uuid primary key default gen_random_uuid(),
  ticket_no        text not null unique,
  requester_id     uuid not null references public.profiles (id) on delete restrict,
  student_id       uuid references public.students (id) on delete set null,
  category         text not null check (category in ('certificate_enquiry','certificate_request','fee_issue','receipt_request','record_correction','document_verification','general_enquiry','other')),
  subject          text not null check (char_length(subject) between 4 and 160),
  description      text not null check (char_length(description) between 10 and 5000),
  priority         text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status           text not null default 'open' check (status in ('open','assigned','in_progress','waiting_student','resolved','closed')),
  assigned_to      uuid references public.profiles (id) on delete set null,
  escalated_to     uuid references public.profiles (id) on delete set null,
  escalated_at     timestamptz,
  first_response_at timestamptz,
  resolved_at      timestamptz,
  closed_at        timestamptz,
  reopened_count   int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index tickets_requester_idx on public.tickets (requester_id, created_at desc);
create index tickets_status_idx on public.tickets (status);
create index tickets_assigned_idx on public.tickets (assigned_to) where status not in ('resolved','closed');
create trigger tickets_updated before update on public.tickets for each row execute function public.set_updated_at();

alter table public.office_tasks add constraint office_tasks_ticket_fk foreign key (ticket_id) references public.tickets (id) on delete set null;

create table public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  body        text not null check (char_length(body) between 1 and 5000),
  is_internal boolean not null default false,
  created_at  timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

create table public.ticket_events (
  id          bigint generated always as identity primary key,
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  from_status text, to_status text,
  note        text,
  created_at  timestamptz not null default now()
);
create index ticket_events_ticket_idx on public.ticket_events (ticket_id, created_at);

create or replace function public.ticket_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.ticket_no := replace(public.next_reference('TKT', 4), '/', '-');
    new.requester_id := coalesce(auth.uid(), new.requester_id);
    new.student_id := coalesce(new.student_id, (select id from public.students where profile_id = new.requester_id));
    new.status := case when new.assigned_to is not null then 'assigned' else 'open' end;
    new.escalated_to := null; new.escalated_at := null; new.first_response_at := null;
    new.resolved_at := null; new.closed_at := null; new.reopened_count := 0;
    return new;
  end if;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null and new.status = 'open' then
    new.status := 'assigned';
  end if;
  if new.status = 'resolved' and old.status <> 'resolved' then new.resolved_at := now(); end if;
  if new.status = 'closed' and old.status <> 'closed' then new.closed_at := now(); end if;
  if old.status in ('resolved','closed') and new.status not in ('resolved','closed') then
    new.reopened_count := old.reopened_count + 1; new.resolved_at := null; new.closed_at := null;
  end if;
  if new.escalated_to is distinct from old.escalated_to and new.escalated_to is not null then new.escalated_at := now(); end if;
  return new;
end $$;
create trigger tickets_before before insert or update on public.tickets for each row execute function public.ticket_before();

-- Students may only change a limited set of things on their own tickets.
create or replace function public.ticket_requester_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.requester_id and not public.has_permission('helpdesk.handle') then
    if new.assigned_to is distinct from old.assigned_to or new.priority is distinct from old.priority
       or new.escalated_to is distinct from old.escalated_to or new.category is distinct from old.category
       or new.subject is distinct from old.subject or new.description is distinct from old.description then
      raise exception 'You can only reopen or close your own request';
    end if;
    -- requester may close a resolved ticket, or reopen within 14 days of resolution
    if new.status is distinct from old.status and not (
         (old.status = 'resolved' and new.status = 'closed')
      or (old.status in ('resolved','closed') and new.status = 'open' and coalesce(old.resolved_at, old.closed_at) > now() - interval '14 days')
      or (old.status = 'waiting_student' and new.status = 'in_progress')) then
      raise exception 'This status change is not permitted';
    end if;
  end if;
  return new;
end $$;
create trigger tickets_requester_guard before update on public.tickets for each row execute function public.ticket_requester_guard();

create or replace function public.ticket_track()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_events (ticket_id, actor_id, to_status) values (new.id, auth.uid(), new.status);
  elsif new.status is distinct from old.status then
    insert into public.ticket_events (ticket_id, actor_id, from_status, to_status) values (new.id, auth.uid(), old.status, new.status);
  end if;
  if tg_op = 'UPDATE' and new.escalated_to is distinct from old.escalated_to and new.escalated_to is not null then
    insert into public.ticket_events (ticket_id, actor_id, from_status, to_status, note) values (new.id, auth.uid(), new.status, new.status, 'Escalated to supervisor');
  end if;
  return new;
end $$;
create trigger tickets_track after insert or update on public.tickets for each row execute function public.ticket_track();

-- Staff replies set first response time; student replies move a
-- "waiting for student" ticket back into progress.
create or replace function public.ticket_message_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = new.ticket_id;
  if new.author_id = t.requester_id then
    if t.status = 'waiting_student' then
      update public.tickets set status = 'in_progress' where id = t.id;
    end if;
  elsif not new.is_internal then
    update public.tickets set first_response_at = coalesce(first_response_at, now()),
      status = case when status in ('open','assigned') then 'in_progress' else status end
    where id = t.id;
  end if;
  return new;
end $$;
create trigger ticket_messages_after after insert on public.ticket_messages for each row execute function public.ticket_message_after();

-- Parent communication ------------------------------------------------------
create table public.parent_threads (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  subject    text not null check (char_length(subject) between 4 and 160),
  status     text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index parent_threads_parent_idx on public.parent_threads (parent_id, updated_at desc);
create trigger parent_threads_updated before update on public.parent_threads for each row execute function public.set_updated_at();

create table public.parent_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.parent_threads (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index parent_messages_thread_idx on public.parent_messages (thread_id, created_at);

create or replace function public.parent_message_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.parent_threads set updated_at = now() where id = new.thread_id;
  return new;
end $$;
create trigger parent_messages_after after insert on public.parent_messages for each row execute function public.parent_message_after();

-- Access to an office file
create or replace function public.can_access_office_file(p_file uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission('files.view_all') or exists (
    select 1 from public.office_files f
    where f.id = p_file and public.has_permission('files.manage') and (
      f.created_by = auth.uid() or f.assigned_to = auth.uid()
      or exists (select 1 from public.staff_sections ss where ss.user_id = auth.uid() and ss.section_id = f.section_id)
    )
  );
$$;

create or replace function public.can_access_ticket(p_ticket uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tickets t where t.id = p_ticket and (
      t.requester_id = auth.uid()
      or public.has_permission('helpdesk.view_all')
      or (public.has_permission('helpdesk.handle') and (t.assigned_to = auth.uid() or t.escalated_to = auth.uid() or t.assigned_to is null))
    )
  );
$$;

create or replace function public.can_access_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.office_tasks t where t.id = p_task and public.is_office_staff() and (
      t.assigned_to = auth.uid() or t.created_by = auth.uid() or public.has_permission('tasks.view_all')
    )
  );
$$;

create or replace function public.can_access_parent_thread(p_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_threads t where t.id = p_thread and (
      (t.parent_id = auth.uid() and public.parent_can_view_student(t.student_id))
      or public.has_permission('parents.respond')
    )
  );
$$;

-- Central document access check used by RLS on public.documents and the
-- download route. One place to reason about.
create or replace function public.can_access_entity(p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_type
    when 'office_file' then public.can_access_office_file(p_id)
    when 'ticket' then public.can_access_ticket(p_id)
    when 'letter' then public.has_permission('letters.view')
    when 'task' then public.can_access_task(p_id)
    when 'parent_thread' then public.can_access_parent_thread(p_id)
    else false end;
$$;
