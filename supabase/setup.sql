-- ONE-STEP SETUP: all migrations combined, in order. Paste into Supabase → SQL Editor → Run.
-- Generated from supabase/migrations/*.sql — run on a NEW, empty project, once.

-- ===== 20261113000100_core.sql =====
-- =====================================================================
-- 0001 CORE: roles, profiles, permissions, settings, references, security
-- =====================================================================
create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------
create type public.app_role as enum (
  'student', 'faculty', 'parent', 'admin',
  'office_clerk', 'office_superintendent', 'accountant', 'office_supervisor'
);

-- ---------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 120),
  email       citext unique,
  phone       text check (phone is null or phone ~ '^[0-9+() -]{6,20}$'),
  avatar_path text,
  is_active   boolean not null default true,
  notification_prefs jsonb not null default '{"email": true}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index user_roles_role_idx on public.user_roles (role);

-- Create a profile automatically whenever an auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- Fine-grained permissions (editable by administrators)
-- ---------------------------------------------------------------------
create table public.permissions (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  module      text not null,
  description text not null
);

create table public.role_permissions (
  role           public.app_role not null,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role, permission_key)
);

-- ---------------------------------------------------------------------
-- Authorization helpers. SECURITY DEFINER so they can be used inside RLS
-- policies without recursive policy evaluation.
-- ---------------------------------------------------------------------
create or replace function public.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role = r and p.is_active
  );
$$;

create or replace function public.has_any_role(rs public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role = any (rs) and p.is_active
  );
$$;

create or replace function public.has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = auth.uid() and p.is_active and rp.permission_key = perm
  );
$$;

create or replace function public.is_office_staff()
returns boolean language sql stable as $$
  select public.has_any_role(array['office_clerk','office_superintendent','accountant','office_supervisor']::public.app_role[]);
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.has_role('admin');
$$;

-- Users with permission of a given key (used by notifications/escalation)
create or replace function public.users_with_permission(perm text)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct ur.user_id from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join public.role_permissions rp on rp.role = ur.role
  where rp.permission_key = perm and p.is_active;
$$;

-- Protect the last administrator from being removed.
create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'Cannot remove the last administrator';
  end if;
  return old;
end $$;
create trigger user_roles_guard_admin before delete on public.user_roles
  for each row execute function public.guard_last_admin();

-- ---------------------------------------------------------------------
-- College settings (single row)
-- ---------------------------------------------------------------------
create table public.site_settings (
  id               smallint primary key default 1 check (id = 1),
  college_name     text not null default 'Your College Name',
  short_name       text not null default 'College',
  motto            text not null default 'Knowledge with character',
  intro            text not null default '',
  logo_path        text,
  email            text,
  phone            text,
  address          text,
  map_url          text,
  established_year int check (established_year between 1800 and 2100),
  affiliation      text,
  footer_text      text,
  social           jsonb not null default '{}'::jsonb,
  home_sections    jsonb not null default '["intro","departments","programmes","achievements","announcements","news","events","gallery","calendar","faculty","contact"]'::jsonb,
  currency         text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  require_mfa_privileged boolean not null default false,
  email_notifications    boolean not null default true,
  backup_notes     text,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id) on delete set null
);
insert into public.site_settings (id) values (1);
create trigger site_settings_updated before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Reference numbers: concurrency-safe yearly counters
-- ---------------------------------------------------------------------
create table public.reference_counters (
  prefix text not null,
  year   int  not null,
  value  int  not null default 0,
  primary key (prefix, year)
);

create or replace function public.next_reference(p_prefix text, p_width int default 5)
returns text language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from now())::int;
  v int;
begin
  insert into public.reference_counters (prefix, year, value) values (p_prefix, y, 1)
  on conflict (prefix, year) do update set value = public.reference_counters.value + 1
  returning value into v;
  return p_prefix || '/' || y || '/' || lpad(v::text, p_width, '0');
end $$;
revoke all on function public.next_reference(text, int) from public;

-- ---------------------------------------------------------------------
-- Essential security event recording (not a dashboard)
-- ---------------------------------------------------------------------
create table public.security_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete set null,
  event      text not null,
  ip         text,
  user_agent text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index security_events_user_idx on public.security_events (user_id, created_at desc);
create index security_events_event_idx on public.security_events (event, created_at desc);

-- ---------------------------------------------------------------------
-- Rate limiting for sensitive endpoints (fixed window)
-- ---------------------------------------------------------------------
create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         int not null default 0
);

create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  r public.rate_limits;
begin
  insert into public.rate_limits as rl (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.hits + 1 end,
    window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning * into r;
  return r.hits <= p_max;  -- true = allowed
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public;

-- ===== 20261113000200_academic.sql =====
-- =====================================================================
-- 0002 ACADEMIC STRUCTURE: departments, programmes, courses, people,
-- terms, offerings, timetable, examinations, marks, results, resources
-- =====================================================================

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{2,10}$'),
  name        text not null unique,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  summary     text not null default '',
  description text not null default '',
  image_path  text,
  established_year int,
  sort_order  int not null default 0,
  is_published boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger departments_updated before update on public.departments for each row execute function public.set_updated_at();

create table public.programmes (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  code          text not null unique check (code ~ '^[A-Z0-9-]{2,16}$'),
  name          text not null,
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  level         text not null check (level in ('UG','PG','Diploma','Certificate','Doctoral')),
  duration_semesters int not null check (duration_semesters between 1 and 12),
  intake        int check (intake > 0),
  summary       text not null default '',
  description   text not null default '',
  eligibility   text not null default '',
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index programmes_department_idx on public.programmes (department_id);
create trigger programmes_updated before update on public.programmes for each row execute function public.set_updated_at();

create table public.academic_years (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique check (label ~ '^[0-9]{4}-[0-9]{2}$'),
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create unique index academic_years_one_current on public.academic_years (is_current) where is_current;

create table public.terms (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  name             text not null,
  term_type        text not null check (term_type in ('odd','even')),
  starts_on        date not null,
  ends_on          date not null,
  is_current       boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (academic_year_id, term_type),
  check (ends_on > starts_on)
);
create unique index terms_one_current on public.terms (is_current) where is_current;

create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  programme_id  uuid references public.programmes (id) on delete set null,
  code          text not null unique check (code ~ '^[A-Z0-9-]{3,16}$'),
  title         text not null,
  credits       numeric(3,1) not null default 4 check (credits > 0 and credits <= 30),
  semester_number int check (semester_number between 1 and 12),
  course_type   text not null default 'core' check (course_type in ('core','elective','common','language','practical')),
  description   text not null default '',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index courses_department_idx on public.courses (department_id);
create index courses_programme_idx on public.courses (programme_id);
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();

create table public.batches (
  id               uuid primary key default gen_random_uuid(),
  programme_id     uuid not null references public.programmes (id) on delete restrict,
  name             text not null unique,
  start_year       int not null check (start_year between 1990 and 2100),
  current_semester int not null default 1 check (current_semester between 1 and 12),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index batches_programme_idx on public.batches (programme_id);

-- People ---------------------------------------------------------------
create table public.students (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null unique references public.profiles (id) on delete restrict,
  register_no      text not null unique,
  admission_no     text unique,
  programme_id     uuid not null references public.programmes (id) on delete restrict,
  batch_id         uuid references public.batches (id) on delete set null,
  current_semester int not null default 1 check (current_semester between 1 and 12),
  date_of_birth    date,
  gender           text check (gender in ('female','male','other','undisclosed')),
  address          text,
  guardian_name    text,
  guardian_phone   text,
  emergency_contact text,
  status           text not null default 'active' check (status in ('active','graduated','withdrawn','suspended')),
  admitted_on      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index students_programme_idx on public.students (programme_id);
create index students_batch_idx on public.students (batch_id);
create trigger students_updated before update on public.students for each row execute function public.set_updated_at();

create table public.faculty (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null unique references public.profiles (id) on delete restrict,
  employee_no    text not null unique,
  department_id  uuid not null references public.departments (id) on delete restrict,
  designation    text not null,
  qualification  text not null default '',
  specialization text not null default '',
  bio            text not null default '',
  photo_path     text,
  joined_on      date,
  is_public      boolean not null default true,
  is_hod         boolean not null default false,
  sort_order     int not null default 100,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index faculty_department_idx on public.faculty (department_id);
create trigger faculty_updated before update on public.faculty for each row execute function public.set_updated_at();

create table public.parent_links (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references public.profiles (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  relationship text not null check (relationship in ('mother','father','guardian','other')),
  status       text not null default 'pending' check (status in ('pending','active','revoked')),
  consent_recorded boolean not null default false,   -- student consent (adult students)
  verified_by  uuid references public.profiles (id) on delete set null,
  verified_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (parent_id, student_id),
  check (status <> 'active' or (verified_at is not null and consent_recorded))
);
create index parent_links_student_idx on public.parent_links (student_id);

-- Office sections (used by staff and files)
create table public.office_sections (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  code       text not null unique check (code ~ '^[A-Z]{2,8}$'),
  created_at timestamptz not null default now()
);

create table public.staff_sections (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  section_id uuid not null references public.office_sections (id) on delete cascade,
  primary key (user_id, section_id)
);

-- Offerings & enrolment -------------------------------------------------
create table public.course_offerings (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses (id) on delete restrict,
  term_id         uuid not null references public.terms (id) on delete restrict,
  batch_id        uuid not null references public.batches (id) on delete restrict,
  semester_number int not null check (semester_number between 1 and 12),
  created_at      timestamptz not null default now(),
  unique (course_id, term_id, batch_id)
);
create index offerings_term_idx on public.course_offerings (term_id);
create index offerings_batch_idx on public.course_offerings (batch_id);

create table public.offering_faculty (
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  faculty_id  uuid not null references public.faculty (id) on delete restrict,
  is_primary  boolean not null default true,
  primary key (offering_id, faculty_id)
);
create index offering_faculty_faculty_idx on public.offering_faculty (faculty_id);

create table public.enrolments (
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (offering_id, student_id)
);
create index enrolments_student_idx on public.enrolments (student_id);

create table public.timetable_slots (
  id          uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),  -- ISO: 1 = Monday
  starts_at   time not null,
  ends_at     time not null,
  room        text not null default '',
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index timetable_offering_idx on public.timetable_slots (offering_id);
create index timetable_day_idx on public.timetable_slots (day_of_week, starts_at);

-- Examinations ------------------------------------------------------------
create table public.exams (
  id           uuid primary key default gen_random_uuid(),
  term_id      uuid not null references public.terms (id) on delete restrict,
  name         text not null,
  exam_type    text not null check (exam_type in ('internal','model','semester','supplementary')),
  max_marks    numeric(6,2) not null default 100 check (max_marks > 0),
  pass_percent numeric(5,2) not null default 40 check (pass_percent between 0 and 100),
  starts_on    date,
  ends_on      date,
  status       text not null default 'scheduled' check (status in ('scheduled','marks_entry','closed','published')),
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (term_id, name)
);
create trigger exams_updated before update on public.exams for each row execute function public.set_updated_at();

create table public.exam_sessions (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.exams (id) on delete cascade,
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  sits_on     date not null,
  starts_at   time not null,
  ends_at     time not null,
  venue       text not null default '',
  unique (exam_id, offering_id),
  check (ends_at > starts_at)
);
create index exam_sessions_offering_idx on public.exam_sessions (offering_id);

create table public.mark_sheets (
  id           uuid primary key default gen_random_uuid(),
  exam_id      uuid not null references public.exams (id) on delete cascade,
  offering_id  uuid not null references public.course_offerings (id) on delete cascade,
  status       text not null default 'draft' check (status in ('draft','submitted','returned')),
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  return_note  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (exam_id, offering_id)
);
create trigger mark_sheets_updated before update on public.mark_sheets for each row execute function public.set_updated_at();

create table public.marks (
  id            uuid primary key default gen_random_uuid(),
  mark_sheet_id uuid not null references public.mark_sheets (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  marks         numeric(6,2) check (marks >= 0),
  is_absent     boolean not null default false,
  entered_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  unique (mark_sheet_id, student_id),
  check (not (is_absent and marks is not null))
);
create index marks_student_idx on public.marks (student_id);
create trigger marks_updated before update on public.marks for each row execute function public.set_updated_at();

-- Validate marks against the exam maximum and lock submitted sheets.
create or replace function public.validate_mark()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max numeric; v_status text; v_sheet_status text;
begin
  select e.max_marks, e.status, ms.status into v_max, v_status, v_sheet_status
  from public.mark_sheets ms join public.exams e on e.id = ms.exam_id
  where ms.id = new.mark_sheet_id;
  if new.marks is not null and new.marks > v_max then
    raise exception 'Marks % exceed the maximum of %', new.marks, v_max using errcode = '22003';
  end if;
  if v_status in ('published','closed') then
    raise exception 'Marks entry is closed for this examination';
  end if;
  if v_sheet_status = 'submitted' and current_setting('app.bypass_mark_lock', true) is distinct from 'on' then
    raise exception 'This mark sheet has been submitted and is locked';
  end if;
  return new;
end $$;
create trigger marks_validate before insert or update on public.marks for each row execute function public.validate_mark();

-- Published results: immutable snapshot visible to students/parents.
create table public.results (
  id           uuid primary key default gen_random_uuid(),
  exam_id      uuid not null references public.exams (id) on delete restrict,
  offering_id  uuid not null references public.course_offerings (id) on delete restrict,
  student_id   uuid not null references public.students (id) on delete cascade,
  course_code  text not null,
  course_title text not null,
  credits      numeric(3,1) not null,
  marks        numeric(6,2),
  max_marks    numeric(6,2) not null,
  percentage   numeric(5,2),
  grade        text not null,
  grade_point  numeric(3,1) not null,
  passed       boolean not null,
  is_absent    boolean not null default false,
  semester_number int not null,
  published_at timestamptz not null default now(),
  unique (exam_id, offering_id, student_id)
);
create index results_student_idx on public.results (student_id, published_at desc);

-- Grade scale (10-point). Pure function used by publishing.
create or replace function public.grade_for(p_percent numeric, p_pass numeric default 40)
returns table (grade text, grade_point numeric) language sql immutable as $$
  select g.grade, g.gp from (values
    (90::numeric, 'O',  10.0::numeric),
    (80, 'A+', 9.0),
    (70, 'A',  8.0),
    (60, 'B+', 7.0),
    (50, 'B',  6.0),
    (45, 'C',  5.0)
  ) as g(min_pct, grade, gp)
  where p_percent is not null and p_percent >= g.min_pct and p_percent >= p_pass
  union all
  select 'P', 4.0 where p_percent is not null and p_percent >= p_pass and p_percent < 45
  union all
  select 'F', 0.0 where p_percent is null or p_percent < p_pass
  order by 2 desc
  limit 1;
$$;

-- Study resources ---------------------------------------------------------
create table public.study_resources (
  id            uuid primary key default gen_random_uuid(),
  offering_id   uuid not null references public.course_offerings (id) on delete cascade,
  title         text not null check (char_length(title) between 2 and 160),
  description   text not null default '',
  resource_kind text not null default 'notes' check (resource_kind in ('notes','slides','reading','syllabus','question_bank','reference','other')),
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  is_published  boolean not null default true,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index study_resources_offering_idx on public.study_resources (offering_id);
create trigger study_resources_updated before update on public.study_resources for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Academic helper functions for RLS
-- ---------------------------------------------------------------------
create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.students where profile_id = auth.uid();
$$;

create or replace function public.current_faculty_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.faculty where profile_id = auth.uid();
$$;

create or replace function public.faculty_teaches_offering(p_offering uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.offering_faculty of
    join public.faculty f on f.id = of.faculty_id
    where of.offering_id = p_offering and f.profile_id = auth.uid()
  ) and public.has_role('faculty');
$$;

create or replace function public.faculty_teaches_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrolments e
    join public.offering_faculty of on of.offering_id = e.offering_id
    join public.faculty f on f.id = of.faculty_id
    where e.student_id = p_student and f.profile_id = auth.uid()
  ) and public.has_role('faculty');
$$;

create or replace function public.parent_can_view_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_links pl
    where pl.student_id = p_student and pl.parent_id = auth.uid() and pl.status = 'active'
  ) and public.has_role('parent');
$$;

create or replace function public.student_in_offering(p_offering uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrolments e
    join public.students s on s.id = e.student_id
    where e.offering_id = p_offering and s.profile_id = auth.uid()
  );
$$;

-- A profile visible to the current user? (names of people one works with)
create or replace function public.can_view_profile(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile = auth.uid()
    or public.has_permission('users.manage')
    or public.has_permission('students.lookup')
    or public.is_office_staff()
    -- faculty: their students
    or exists (select 1 from public.students s where s.profile_id = p_profile and public.faculty_teaches_student(s.id))
    -- parent: linked student
    or exists (select 1 from public.students s where s.profile_id = p_profile and public.parent_can_view_student(s.id))
    -- everybody signed in may see faculty and office staff names
    or exists (select 1 from public.faculty f where f.profile_id = p_profile)
    or exists (select 1 from public.user_roles ur where ur.user_id = p_profile
               and ur.role in ('office_clerk','office_superintendent','accountant','office_supervisor','admin'));
$$;

-- ===== 20261113000300_finance.sql =====
-- =====================================================================
-- 0003 FEES & ACCOUNTS
-- Money is numeric(12,2). Online payments are only "verified" after a
-- server-side signature check. Sandbox payments are stored with
-- mode = 'sandbox' and are excluded from every financial total.
-- =====================================================================

create table public.fee_heads (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9_]{2,16}$'),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table public.fee_structures (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  programme_id     uuid not null references public.programmes (id) on delete restrict,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  semester_number  int not null check (semester_number between 1 and 12),
  due_date         date not null,
  is_active        boolean not null default true,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (programme_id, academic_year_id, semester_number, name)
);
create trigger fee_structures_updated before update on public.fee_structures for each row execute function public.set_updated_at();

create table public.fee_structure_items (
  id           uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.fee_structures (id) on delete cascade,
  fee_head_id  uuid not null references public.fee_heads (id) on delete restrict,
  amount       numeric(12,2) not null check (amount > 0),
  unique (structure_id, fee_head_id)
);

-- Fee assignment to a student
create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  invoice_no   text not null unique,
  student_id   uuid not null references public.students (id) on delete restrict,
  structure_id uuid references public.fee_structures (id) on delete set null,
  title        text not null,
  amount       numeric(12,2) not null check (amount > 0),
  due_date     date not null,
  issued_by    uuid references public.profiles (id) on delete set null,
  issued_at    timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text,
  last_reminded_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (student_id, structure_id)
);
create index invoices_student_idx on public.invoices (student_id);
create index invoices_due_idx on public.invoices (due_date) where cancelled_at is null;

create table public.concessions (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete restrict,
  student_id  uuid not null references public.students (id) on delete restrict,
  amount      numeric(12,2) not null check (amount > 0),
  category    text not null check (category in ('merit','need_based','staff_ward','sibling','sports','other')),
  reason      text not null check (char_length(reason) >= 5),
  status      text not null default 'approved' check (status in ('approved','revoked')),
  approved_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index concessions_invoice_idx on public.concessions (invoice_id);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.students (id) on delete restrict,
  invoice_id          uuid not null references public.invoices (id) on delete restrict,
  amount              numeric(12,2) not null check (amount > 0),
  method              text not null check (method in ('cash','bank_transfer','upi','cheque','demand_draft','online')),
  mode                text not null default 'live' check (mode in ('live','sandbox')),
  status              text not null default 'pending' check (status in ('pending','verified','failed','reversed')),
  provider            text,                 -- e.g. 'razorpay', 'sandbox', null for counter collection
  provider_order_id   text,
  provider_payment_id text,
  reference_no        text,                 -- cheque / UTR / DD number
  idempotency_key     text unique,
  collected_by        uuid references public.profiles (id) on delete set null,
  paid_at             timestamptz,
  notes               text,
  reconciled_at       timestamptz,
  reconciled_by       uuid references public.profiles (id) on delete set null,
  bank_reference      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, provider_payment_id),
  check (status <> 'verified' or paid_at is not null)
);
create unique index payments_provider_order_uniq on public.payments (provider, provider_order_id) where provider_order_id is not null;
create index payments_student_idx on public.payments (student_id);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_paid_idx on public.payments (paid_at) where status = 'verified';
create trigger payments_updated before update on public.payments for each row execute function public.set_updated_at();

create table public.receipts (
  id         uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  issued_by  uuid references public.profiles (id) on delete set null,
  issued_at  timestamptz not null default now()
);

create table public.refunds (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments (id) on delete restrict,
  student_id   uuid not null references public.students (id) on delete restrict,
  amount       numeric(12,2) not null check (amount > 0),
  reason       text not null check (char_length(reason) >= 5),
  status       text not null default 'requested' check (status in ('requested','approved','rejected','processed')),
  requested_by uuid references public.profiles (id) on delete set null,
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  decision_note text,
  processed_at timestamptz,
  processed_reference text,
  created_at   timestamptz not null default now()
);
create index refunds_payment_idx on public.refunds (payment_id);

create table public.payment_corrections (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments (id) on delete restrict,
  field        text not null check (field in ('reference_no','method','paid_at','notes','status')),
  old_value    text,
  new_value    text,
  reason       text not null check (char_length(reason) >= 5),
  corrected_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Reference numbers
create or replace function public.set_invoice_no() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.invoice_no is null or new.invoice_no = '' then new.invoice_no := public.next_reference('INV', 6); end if;
  return new;
end $$;
create trigger invoices_no before insert on public.invoices for each row execute function public.set_invoice_no();

create or replace function public.set_receipt_no() returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text; v_mode text;
begin
  select status, mode into v_status, v_mode from public.payments where id = new.payment_id;
  if v_status is distinct from 'verified' then
    raise exception 'Receipts can only be issued for verified payments';
  end if;
  new.receipt_no := case when v_mode = 'sandbox' then public.next_reference('SANDBOX-RCPT', 6) else public.next_reference('RCPT', 6) end;
  return new;
end $$;
create trigger receipts_no before insert on public.receipts for each row execute function public.set_receipt_no();

-- Payment amount cannot exceed the invoice's outstanding balance.
create or replace function public.invoice_outstanding(p_invoice uuid, p_exclude_payment uuid default null)
returns numeric language sql stable security definer set search_path = public as $$
  select i.amount
    - coalesce((select sum(c.amount) from public.concessions c where c.invoice_id = i.id and c.status = 'approved'), 0)
    - coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id and p.status = 'verified' and p.mode = 'live'
                and (p_exclude_payment is null or p.id <> p_exclude_payment)), 0)
    + coalesce((select sum(r.amount) from public.refunds r join public.payments p on p.id = r.payment_id
                where p.invoice_id = i.id and r.status = 'processed' and p.mode = 'live'), 0)
  from public.invoices i where i.id = p_invoice;
$$;

create or replace function public.guard_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_cancelled timestamptz;
begin
  select student_id, cancelled_at into v_student, v_cancelled from public.invoices where id = new.invoice_id;
  if v_student is distinct from new.student_id then
    raise exception 'Payment student does not match invoice';
  end if;
  if tg_op = 'INSERT' and v_cancelled is not null then
    raise exception 'Invoice is cancelled';
  end if;
  -- Counter collections may never exceed the balance. Gateway payments are
  -- recorded exactly as received (money has already moved); any excess shows
  -- as a credit that accounts can refund.
  if new.status = 'verified' and new.mode = 'live' and new.provider is null
     and (tg_op = 'INSERT' or old.status is distinct from 'verified')
     and new.amount > public.invoice_outstanding(new.invoice_id, new.id) then
    raise exception 'Payment of % exceeds outstanding balance of %', new.amount, public.invoice_outstanding(new.invoice_id, new.id)
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger payments_guard before insert or update on public.payments for each row execute function public.guard_payment();

create or replace function public.guard_concession()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prior numeric := 0;
begin
  if tg_op = 'UPDATE' and old.status = 'approved' then v_prior := old.amount; end if;
  if new.status = 'approved' and new.amount > public.invoice_outstanding(new.invoice_id) + v_prior then
    raise exception 'Concession exceeds outstanding balance' using errcode = '23514';
  end if;
  if (select student_id from public.invoices where id = new.invoice_id) is distinct from new.student_id then
    raise exception 'Concession student does not match invoice';
  end if;
  return new;
end $$;
create trigger concessions_guard before insert or update on public.concessions for each row execute function public.guard_concession();

create or replace function public.guard_refund()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_paid numeric; v_refunded numeric; v_status text; v_mode text;
begin
  select amount, status, mode into v_paid, v_status, v_mode from public.payments where id = new.payment_id;
  if v_status <> 'verified' or v_mode <> 'live' then raise exception 'Only verified live payments can be refunded'; end if;
  select coalesce(sum(amount), 0) into v_refunded from public.refunds
    where payment_id = new.payment_id and status in ('requested','approved','processed') and id <> new.id;
  if new.status in ('requested','approved','processed') and v_refunded + new.amount > v_paid then
    raise exception 'Refund exceeds the refundable amount' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger refunds_guard before insert or update on public.refunds for each row execute function public.guard_refund();

-- ---------------------------------------------------------------------
-- Balances (security_invoker: RLS of the caller applies)
-- ---------------------------------------------------------------------
create view public.invoice_balances with (security_invoker = true) as
select
  i.id as invoice_id, i.invoice_no, i.student_id, i.title, i.amount, i.due_date, i.issued_at, i.cancelled_at,
  coalesce(c.total, 0) as concession_total,
  coalesce(p.total, 0) as paid_total,
  coalesce(r.total, 0) as refunded_total,
  case when i.cancelled_at is not null then 0
       else i.amount - coalesce(c.total, 0) - coalesce(p.total, 0) + coalesce(r.total, 0) end as outstanding,
  case
    when i.cancelled_at is not null then 'cancelled'
    when i.amount - coalesce(c.total, 0) - coalesce(p.total, 0) + coalesce(r.total, 0) <= 0 then 'paid'
    when coalesce(p.total, 0) > 0 then 'partially_paid'
    when i.due_date < current_date then 'overdue'
    else 'open'
  end as status
from public.invoices i
left join lateral (select sum(amount) total from public.concessions where invoice_id = i.id and status = 'approved') c on true
left join lateral (select sum(amount) total from public.payments where invoice_id = i.id and status = 'verified' and mode = 'live') p on true
left join lateral (select sum(r.amount) total from public.refunds r join public.payments pp on pp.id = r.payment_id
                   where pp.invoice_id = i.id and r.status = 'processed' and pp.mode = 'live') r on true;

create view public.student_fee_balances with (security_invoker = true) as
select
  s.id as student_id,
  coalesce(sum(b.amount) filter (where b.cancelled_at is null), 0) as total_assigned,
  coalesce(sum(b.concession_total) filter (where b.cancelled_at is null), 0) as total_concession,
  coalesce(sum(b.paid_total), 0) as total_paid,
  coalesce(sum(b.refunded_total), 0) as total_refunded,
  coalesce(sum(b.outstanding), 0) as outstanding,
  min(b.due_date) filter (where b.outstanding > 0) as next_due
from public.students s
left join public.invoice_balances b on b.student_id = s.id
group by s.id;

-- ---------------------------------------------------------------------
-- Counter collection: atomic payment + receipt, idempotent.
-- ---------------------------------------------------------------------
create or replace function public.record_counter_payment(
  p_invoice uuid, p_amount numeric, p_method text, p_reference text,
  p_paid_at timestamptz, p_notes text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_payment uuid; v_student uuid; v_existing uuid;
begin
  if not public.has_permission('finance.collect') then
    raise exception 'Not authorised to collect fees' using errcode = '42501';
  end if;
  if p_method not in ('cash','bank_transfer','upi','cheque','demand_draft') then
    raise exception 'Invalid payment method';
  end if;
  if p_method <> 'cash' and coalesce(trim(p_reference), '') = '' then
    raise exception 'A transaction reference is required for non-cash payments';
  end if;
  select id into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;  -- duplicate submission: return the original payment
  end if;
  select student_id into v_student from public.invoices where id = p_invoice;
  if v_student is null then raise exception 'Invoice not found'; end if;

  insert into public.payments (student_id, invoice_id, amount, method, mode, status, reference_no,
                               idempotency_key, collected_by, paid_at, notes)
  values (v_student, p_invoice, round(p_amount, 2), p_method, 'live', 'verified', nullif(trim(p_reference), ''),
          p_idempotency_key, auth.uid(), coalesce(p_paid_at, now()), nullif(trim(p_notes), ''))
  returning id into v_payment;

  insert into public.receipts (payment_id, issued_by) values (v_payment, auth.uid());
  return v_payment;
end $$;

-- Online payment confirmation; called only by the server (service role)
-- after the provider signature has been verified. Idempotent.
create or replace function public.confirm_online_payment(
  p_provider text, p_order_id text, p_payment_id text, p_amount numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare v public.payments;
begin
  select * into v from public.payments where provider = p_provider and provider_order_id = p_order_id for update;
  if v.id is null then raise exception 'Unknown order'; end if;
  if v.status = 'verified' then return v.id; end if;       -- already confirmed (duplicate callback)
  if round(p_amount, 2) <> v.amount then
    update public.payments set status = 'failed', notes = coalesce(notes || E'\n', '') || 'Amount mismatch on callback' where id = v.id;
    raise exception 'Amount mismatch';
  end if;
  update public.payments set status = 'verified', provider_payment_id = p_payment_id, paid_at = now() where id = v.id;
  insert into public.receipts (payment_id) values (v.id);
  return v.id;
end $$;
revoke all on function public.confirm_online_payment(text, text, text, numeric) from public;

-- ===== 20261113000400_office.sql =====
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

-- ===== 20261113000500_cms_notifications.sql =====
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

-- ===== 20261113000600_security.sql =====
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

-- ===== 20261113000700_storage.sql =====
-- =====================================================================
-- 0007 STORAGE
-- public-media : website images (public read, CMS editors write)
-- documents    : PRIVATE. No client policies at all: every upload and
--                download goes through the server, which first checks
--                the caller's access to the owning record via RLS and
--                then issues a short-lived signed URL.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('documents', 'documents', false, 10485760, array[
     'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public media read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'public-media');
create policy "public media write" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and public.has_permission('cms.manage'));
create policy "public media update" on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and public.has_permission('cms.manage'));
create policy "public media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and public.has_permission('cms.manage'));

-- ===== 20261114000800_optional_fields.sql =====
-- =====================================================================
-- 0008 OPTIONAL FIELDS: users can be added with only a name and email.
-- Department, programme and designation may be filled in later.
-- =====================================================================
alter table public.faculty alter column department_id drop not null;
alter table public.faculty alter column designation set default 'Faculty';
alter table public.students alter column programme_id drop not null;

-- Faculty without a department still appear in the public directory.
create or replace view public.public_faculty_directory as
select f.id, p.full_name, f.designation, f.qualification, f.specialization, f.bio, f.photo_path,
       f.is_hod, f.sort_order, d.id as department_id,
       coalesce(d.name, 'General') as department_name, coalesce(d.slug, '') as department_slug
from public.faculty f
join public.profiles p on p.id = f.profile_id and p.is_active
left join public.departments d on d.id = f.department_id
where f.is_public and (d.id is null or d.is_published);
grant select on public.public_faculty_directory to anon, authenticated;
