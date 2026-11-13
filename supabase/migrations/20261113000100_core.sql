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
