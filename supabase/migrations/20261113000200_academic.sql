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
