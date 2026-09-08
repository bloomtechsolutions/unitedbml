\
-- UnitedBML V12.9.4
-- Keep Committee role separate from BML organizational placement.

alter table public.committee_members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.committee_members
  add column if not exists staff_uid text;

create index if not exists committee_members_user_id_idx
  on public.committee_members(user_id);

create index if not exists committee_members_staff_uid_idx
  on public.committee_members(staff_uid);

-- Backfill staff_uid from the existing committee UID, then prefer Profile.member_uid.
update public.committee_members c
set staff_uid=coalesce(
  (
    select p.member_uid
    from public.profiles p
    where lower(coalesce(p.email,''))=lower(coalesce(c.email,''))
       or (c.uid is not null and p.member_uid=c.uid)
    order by case when c.uid is not null and p.member_uid=c.uid then 0 else 1 end
    limit 1
  ),
  nullif(c.uid,'')
)
where c.staff_uid is null or c.staff_uid='';

-- Backfill authenticated user reference using UID first, then email.
update public.committee_members c
set user_id=(
  select p.id
  from public.profiles p
  where (c.staff_uid is not null and p.member_uid=c.staff_uid)
     or lower(coalesce(p.email,''))=lower(coalesce(c.email,''))
  order by case when c.staff_uid is not null and p.member_uid=c.staff_uid then 0 else 1 end
  limit 1
)
where c.user_id is null;

-- Helper used by Committee and reporting views.
create or replace function public.committee_member_staff_profile(p_committee_id text)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select jsonb_build_object(
      'committeeId',c.id,
      'userId',c.user_id,
      'staffUid',coalesce(c.staff_uid,c.uid),
      'name',coalesce(s.full_name,p.full_name,c.name,''),
      'jobTitle',coalesce(s.job_title,''),
      'division',coalesce(s.division,''),
      'department',coalesce(s.department,''),
      'unit',coalesce(s.unit,''),
      'audienceCategory',
        case
          when coalesce(c.user_id,p.id) is not null
            then public.staff_audience_for_user(coalesce(c.user_id,p.id))
          else 'UNCLASSIFIED'
        end
    )
    from public.committee_members c
    left join public.profiles p
      on p.id=c.user_id
      or (c.staff_uid is not null and p.member_uid=c.staff_uid)
      or lower(coalesce(p.email,''))=lower(coalesce(c.email,''))
    left join public.staff s
      on s.uid=coalesce(c.staff_uid,c.uid,p.member_uid)
      or (
        coalesce(c.staff_uid,c.uid,p.member_uid) is null
        and lower(coalesce(s.email,''))=lower(coalesce(c.email,p.email,''))
      )
    where c.id=p_committee_id
    order by
      case when s.uid=coalesce(c.staff_uid,c.uid,p.member_uid) then 0 else 1 end,
      case when p.id=c.user_id then 0 else 1 end
    limit 1
  ),'{}'::jsonb)
$$;

grant execute on function public.committee_member_staff_profile(text) to authenticated;

comment on column public.committee_members.user_id is
'Authenticated UnitedBML user assigned to the Committee position. Organizational fields remain in Staff Master.';
comment on column public.committee_members.staff_uid is
'BML Staff Master UID. Division/Department/Unit are resolved from public.staff and are not duplicated here.';
