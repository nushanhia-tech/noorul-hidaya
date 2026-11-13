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
