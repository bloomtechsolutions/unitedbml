\
-- UnitedBML V12.9.2 Staff Master & Unit-first Location Classification
alter table public.staff add column if not exists job_title text;
alter table public.staff add column if not exists division text;
alter table public.staff add column if not exists department text;
alter table public.staff add column if not exists unit text;

create index if not exists staff_department_idx on public.staff(lower(department));
create index if not exists staff_unit_idx on public.staff(lower(unit));
create index if not exists staff_division_idx on public.staff(lower(division));

update public.staff
set job_title=coalesce(nullif(job_title,''),nullif(data->>'job_title',''),nullif(data->>'jobTitle','')),
    division=coalesce(nullif(division,''),nullif(data->>'division','')),
    department=coalesce(nullif(department,''),nullif(data->>'department',''),nullif(data->>'department_name','')),
    unit=coalesce(nullif(unit,''),nullif(data->>'unit',''),nullif(data->>'branch',''),nullif(data->>'branch_or_unit',''))
where job_title is null or job_title='' or division is null or division='' or department is null or department='' or unit is null or unit='';

create table if not exists public.staff_location_classification (
  id uuid primary key default gen_random_uuid(),
  match_type text not null check(match_type in ('UNIT','DEPARTMENT')),
  match_value text not null,
  audience_category text not null check(audience_category in ('MALE_BASED','ATOLL_BASED')),
  notes text,
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create unique index if not exists staff_location_classification_unique
on public.staff_location_classification(match_type,lower(match_value));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.staff_location_classification'::regclass
      and conname='staff_location_classification_match_unique'
  ) then
    alter table public.staff_location_classification
      add constraint staff_location_classification_match_unique
      unique(match_type,match_value);
  end if;
end $$;

insert into public.staff_location_classification(match_type,match_value,audience_category,notes,active,updated_by,updated_at)
select 'DEPARTMENT',department,audience_category,
       trim(concat_ws(' · ',nullif(branch_or_unit,''),nullif(atoll,''),nullif(notes,''))),
       active,updated_by,updated_at
from public.department_audience_map
where nullif(trim(department),'') is not null
on conflict(match_type,lower(match_value)) do update
set audience_category=excluded.audience_category,notes=coalesce(excluded.notes,public.staff_location_classification.notes),
    active=excluded.active,updated_by=excluded.updated_by,updated_at=excluded.updated_at;

alter table public.staff_location_classification enable row level security;
drop policy if exists staff_location_classification_read on public.staff_location_classification;
drop policy if exists staff_location_classification_write on public.staff_location_classification;
create policy staff_location_classification_read on public.staff_location_classification
for select to authenticated using(public.is_committee_user());
create policy staff_location_classification_write on public.staff_location_classification
for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

create or replace function public.upsert_staff_master_rows(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; affected integer:=0;
begin
  if not public.is_committee_user() then raise exception 'Committee access required'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    if nullif(trim(r->>'uid'),'') is null then continue; end if;
    insert into public.staff(uid,full_name,job_title,division,department,unit,status,data,updated_at)
    values(trim(r->>'uid'),coalesce(nullif(trim(r->>'name'),''),trim(r->>'uid')),
      nullif(trim(r->>'job_title'),''),nullif(trim(r->>'division'),''),
      nullif(trim(r->>'department'),''),nullif(trim(r->>'unit'),''),
      coalesce(nullif(trim(r->>'status'),''),'Active'),
      jsonb_build_object('jobTitle',nullif(trim(r->>'job_title'),''),'division',nullif(trim(r->>'division'),''),
        'department',nullif(trim(r->>'department'),''),'unit',nullif(trim(r->>'unit'),'')),now())
    on conflict(uid) do update set
      full_name=excluded.full_name,job_title=excluded.job_title,division=excluded.division,
      department=excluded.department,unit=excluded.unit,status=excluded.status,
      data=coalesce(public.staff.data,'{}'::jsonb)||excluded.data,updated_at=now();
    affected:=affected+1;
  end loop;
  return jsonb_build_object('ok',true,'affected',affected);
end $$;
grant execute on function public.upsert_staff_master_rows(jsonb) to authenticated;

create or replace function public.staff_department_for_user(p_user_id uuid)
returns text language sql stable security definer set search_path=public as $$
 select coalesce((select nullif(trim(s.department),'') from public.profiles p
 left join public.staff s on (p.member_uid is not null and s.uid=p.member_uid)
 or lower(coalesce(s.email,''))=lower(coalesce(p.email,''))
 where p.id=p_user_id order by case when p.member_uid is not null and s.uid=p.member_uid then 0 else 1 end limit 1),'')
$$;

create or replace function public.staff_unit_for_user(p_user_id uuid)
returns text language sql stable security definer set search_path=public as $$
 select coalesce((select nullif(trim(s.unit),'') from public.profiles p
 left join public.staff s on (p.member_uid is not null and s.uid=p.member_uid)
 or lower(coalesce(s.email,''))=lower(coalesce(p.email,''))
 where p.id=p_user_id order by case when p.member_uid is not null and s.uid=p.member_uid then 0 else 1 end limit 1),'')
$$;

create or replace function public.staff_organization_for_user(p_user_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce((select jsonb_build_object('uid',s.uid,'name',s.full_name,'jobTitle',coalesce(s.job_title,''),
 'division',coalesce(s.division,''),'department',coalesce(s.department,''),'unit',coalesce(s.unit,''))
 from public.profiles p left join public.staff s on (p.member_uid is not null and s.uid=p.member_uid)
 or lower(coalesce(s.email,''))=lower(coalesce(p.email,''))
 where p.id=p_user_id order by case when p.member_uid is not null and s.uid=p.member_uid then 0 else 1 end limit 1),
 jsonb_build_object('uid','','name','','jobTitle','','division','','department','','unit',''))
$$;

create or replace function public.staff_audience_for_user(p_user_id uuid)
returns text language sql stable security definer set search_path=public as $$
 with org as (select public.staff_unit_for_user(p_user_id) unit_name, public.staff_department_for_user(p_user_id) department_name)
 select coalesce(
   (select c.audience_category from public.staff_location_classification c,org
    where c.active and c.match_type='UNIT' and nullif(trim(org.unit_name),'') is not null
      and lower(trim(c.match_value))=lower(trim(org.unit_name)) limit 1),
   (select c.audience_category from public.staff_location_classification c,org
    where c.active and c.match_type='DEPARTMENT' and nullif(trim(org.department_name),'') is not null
      and lower(trim(c.match_value))=lower(trim(org.department_name)) limit 1),
   'UNCLASSIFIED')
$$;

create or replace function public.get_my_staff_audience()
returns jsonb language sql stable security definer set search_path=public as $$
 select public.staff_organization_for_user(auth.uid()) || jsonb_build_object('audienceCategory',public.staff_audience_for_user(auth.uid()))
$$;

grant execute on function public.staff_department_for_user(uuid) to authenticated;
grant execute on function public.staff_unit_for_user(uuid) to authenticated;
grant execute on function public.staff_organization_for_user(uuid) to authenticated;
grant execute on function public.staff_audience_for_user(uuid) to authenticated;
grant execute on function public.get_my_staff_audience() to authenticated;

drop policy if exists committee_manage on public.staff;
drop policy if exists active_user_read on public.staff;
drop policy if exists active_user_write on public.staff;
drop policy if exists staff_master_read on public.staff;
drop policy if exists staff_master_write on public.staff;
create policy staff_master_read on public.staff for select to authenticated using(
 public.is_committee_user() or exists(select 1 from public.profiles p where p.id=auth.uid()
 and ((p.member_uid is not null and p.member_uid=staff.uid) or lower(coalesce(p.email,''))=lower(coalesce(staff.email,''))))
);
create policy staff_master_write on public.staff for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

comment on column public.staff.job_title is 'BML Job Title';
comment on column public.staff.division is 'BML Division';
comment on column public.staff.department is 'BML Department';
comment on column public.staff.unit is 'BML Unit / work location';
