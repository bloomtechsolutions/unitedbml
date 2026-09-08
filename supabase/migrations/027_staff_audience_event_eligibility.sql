-- UnitedBML V12.9
-- Central Staff Audience & Event Eligibility

create table if not exists public.department_audience_map (
  department text primary key,
  audience_category text not null check (audience_category in ('MALE_BASED','ATOLL_BASED')),
  branch_or_unit text,
  atoll text,
  notes text,
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.events
  add column if not exists audience_type text not null default 'ALL_STAFF';

-- Repair any unsupported values before adding a check.
update public.events
set audience_type='ALL_STAFF'
where audience_type is null
   or audience_type not in ('ALL_STAFF','MALE_BASED','ATOLL_BASED');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.events'::regclass
      and conname='events_audience_type_check'
  ) then
    alter table public.events
      add constraint events_audience_type_check
      check (audience_type in ('ALL_STAFF','MALE_BASED','ATOLL_BASED'));
  end if;
end $$;

create index if not exists events_audience_type_idx on public.events(audience_type);
create index if not exists department_audience_category_idx
  on public.department_audience_map(audience_category)
  where active;

create or replace function public.staff_department_for_user(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(
    (
      select nullif(trim(coalesce(
        s.data->>'department',
        s.data->>'unit',
        s.data->>'branch',
        s.data->>'department_name'
      )), '')
      from public.profiles p
      left join public.staff s
        on (p.member_uid is not null and s.uid=p.member_uid)
        or lower(coalesce(s.email,''))=lower(coalesce(p.email,''))
      where p.id=p_user_id
      order by case when p.member_uid is not null and s.uid=p.member_uid then 0 else 1 end
      limit 1
    ),
    ''
  )
$$;

create or replace function public.staff_audience_for_user(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path=public
as $$
  with d as (
    select public.staff_department_for_user(p_user_id) as department
  )
  select coalesce(
    (
      select m.audience_category
      from public.department_audience_map m,d
      where m.active
        and lower(trim(m.department))=lower(trim(d.department))
      limit 1
    ),
    'UNCLASSIFIED'
  )
$$;

create or replace function public.is_staff_eligible_for_event(
  p_event_id text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select
      case
        when e.audience_type='ALL_STAFF' then true
        when e.audience_type='MALE_BASED'
          then public.staff_audience_for_user(p_user_id)='MALE_BASED'
        when e.audience_type='ATOLL_BASED'
          then public.staff_audience_for_user(p_user_id)='ATOLL_BASED'
        else false
      end
    from public.events e
    where e.id=p_event_id
  ),false)
$$;

create or replace function public.is_staff_eligible_for_tournament(
  p_tournament_id text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select public.is_staff_eligible_for_event(t.event_id,p_user_id)
    from public.tournaments t
    where t.id=p_tournament_id
  ),false)
$$;

create or replace function public.get_my_staff_audience()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'department',public.staff_department_for_user(auth.uid()),
    'audienceCategory',public.staff_audience_for_user(auth.uid())
  )
$$;

grant execute on function public.staff_department_for_user(uuid) to authenticated;
grant execute on function public.staff_audience_for_user(uuid) to authenticated;
grant execute on function public.is_staff_eligible_for_event(text,uuid) to authenticated;
grant execute on function public.is_staff_eligible_for_tournament(text,uuid) to authenticated;
grant execute on function public.get_my_staff_audience() to authenticated;

-- Department map is management data.
alter table public.department_audience_map enable row level security;
drop policy if exists department_audience_read on public.department_audience_map;
drop policy if exists department_audience_write on public.department_audience_map;
create policy department_audience_read
on public.department_audience_map
for select to authenticated
using(public.is_committee_user());
create policy department_audience_write
on public.department_audience_map
for all to authenticated
using(public.is_committee_user())
with check(public.is_committee_user());

-- ---------------------------------------------------------------
-- Non-tournament Event registration functions with eligibility.
-- ---------------------------------------------------------------
create or replace function public.self_register_event(
  p_event_id text,
  p_registration_type text default 'Individual'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare e public.events; p public.profiles; rid uuid; dept text;
begin
  select * into e from public.events where id=p_event_id;
  if e.id is null then raise exception 'Event not found'; end if;
  if not public.is_staff_eligible_for_event(e.id,auth.uid()) then
    if public.staff_audience_for_user(auth.uid())='UNCLASSIFIED' and e.audience_type<>'ALL_STAFF' then
      raise exception 'Your staff location classification has not yet been configured. Please contact UnitedBML.';
    end if;
    raise exception 'This activity is not available for your staff location category.';
  end if;
  if not e.registration_enabled then raise exception 'Registration is not open for this event'; end if;
  if e.registration_open_at is not null and now()<e.registration_open_at then raise exception 'Registration has not opened yet'; end if;
  if e.registration_close_at is not null and now()>e.registration_close_at then raise exception 'Registration is closed'; end if;
  if lower(coalesce(e.registration_mode,'none')) not in ('individual','teams') then raise exception 'This event does not accept registrations'; end if;
  select * into p from public.profiles where id=auth.uid();
  if p.id is null then raise exception 'Profile not found'; end if;
  dept:=public.staff_department_for_user(auth.uid());

  insert into public.event_registrations(
    event_id,user_id,staff_uid,staff_name,email,contact_no,department,
    registration_type,status
  )
  values(
    e.id,p.id,p.member_uid,p.full_name,p.email,p.contact_no,dept,
    p_registration_type,'Approved'
  )
  on conflict(event_id,user_id) do update
    set staff_uid=excluded.staff_uid,staff_name=excluded.staff_name,email=excluded.email,
        contact_no=excluded.contact_no,department=excluded.department,
        registration_type=excluded.registration_type,status='Approved',requested_at=now()
  returning id into rid;

  return jsonb_build_object('ok',true,'registration_id',rid);
end $$;

create or replace function public.create_event_team(p_event_id text,p_team_name text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare e public.events; p public.profiles; tid uuid; dept text;
begin
  select * into e from public.events where id=p_event_id;
  if e.id is null or not e.registration_enabled or lower(e.registration_mode)<>'teams' then
    raise exception 'Team registration is not open';
  end if;
  if not public.is_staff_eligible_for_event(e.id,auth.uid()) then
    raise exception 'You are not eligible to create a team for this event.';
  end if;
  if e.registration_close_at is not null and now()>e.registration_close_at then raise exception 'Registration is closed'; end if;
  select * into p from public.profiles where id=auth.uid();
  dept:=public.staff_department_for_user(auth.uid());

  insert into public.event_teams(event_id,team_name,leader_user_id,leader_name,leader_email)
  values(e.id,trim(p_team_name),auth.uid(),p.full_name,p.email)
  returning id into tid;

  insert into public.event_registrations(
    event_id,user_id,staff_uid,staff_name,email,contact_no,department,
    registration_type,team_id,status
  )
  values(e.id,p.id,p.member_uid,p.full_name,p.email,p.contact_no,dept,'Team',tid,'Approved')
  on conflict(event_id,user_id) do update
    set registration_type='Team',team_id=tid,status='Approved',department=excluded.department;

  return jsonb_build_object('ok',true,'team_id',tid);
end $$;

create or replace function public.request_join_event_team(p_team_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare t public.event_teams; e public.events; p public.profiles; dept text;
begin
  select * into t from public.event_teams where id=p_team_id and status='Open';
  if t.id is null then raise exception 'Team is not available'; end if;
  select * into e from public.events where id=t.event_id;
  if not e.registration_enabled or lower(e.registration_mode)<>'teams' then raise exception 'Team registration is not open'; end if;
  if not public.is_staff_eligible_for_event(e.id,auth.uid()) then
    raise exception 'You are not eligible to join a team for this event.';
  end if;
  if e.registration_close_at is not null and now()>e.registration_close_at then raise exception 'Registration is closed'; end if;
  select * into p from public.profiles where id=auth.uid();
  dept:=public.staff_department_for_user(auth.uid());

  insert into public.event_registrations(
    event_id,user_id,staff_uid,staff_name,email,contact_no,department,
    registration_type,team_id,status
  )
  values(t.event_id,p.id,p.member_uid,p.full_name,p.email,p.contact_no,dept,'Team',t.id,'Pending Leader Approval')
  on conflict(event_id,user_id) do update
    set team_id=t.id,registration_type='Team',status='Pending Leader Approval',
        department=excluded.department,requested_at=now();

  return jsonb_build_object('ok',true);
end $$;

create or replace function public.approve_event_team_join(
  p_registration_id uuid,p_approve boolean,p_comment text default null
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r public.event_registrations;
begin
  select * into r from public.event_registrations where id=p_registration_id for update;
  if r.id is null then raise exception 'Registration request not found'; end if;
  if not public.is_committee_user() and not public.is_event_team_leader(r.team_id) then
    raise exception 'Only the team leader or Committee may decide this request';
  end if;
  if p_approve and not public.is_staff_eligible_for_event(r.event_id,r.user_id) then
    raise exception 'This staff member is no longer eligible for this event.';
  end if;
  update public.event_registrations
     set status=case when p_approve then 'Approved' else 'Rejected' end,
         decided_at=now(),decided_by=auth.uid(),
         data=coalesce(data,'{}'::jsonb)||jsonb_build_object('decision_comment',coalesce(p_comment,''))
   where id=r.id;
  return jsonb_build_object('ok',true,'status',case when p_approve then 'Approved' else 'Rejected' end);
end $$;

grant execute on function public.self_register_event(text,text) to authenticated;
grant execute on function public.create_event_team(text,text) to authenticated;
grant execute on function public.request_join_event_team(uuid) to authenticated;
grant execute on function public.approve_event_team_join(uuid,boolean,text) to authenticated;

-- ---------------------------------------------------------------
-- Tournament eligibility. Tournament keeps its existing registration
-- tables but inherits eligibility from tournaments.event_id.
-- ---------------------------------------------------------------

-- Rebuild insert policy because policies are OR-ed; the older permissive
-- policy must be removed rather than supplemented.
drop policy if exists registrations_insert on public.tournament_registrations;
drop policy if exists tournament_registrations_insert on public.tournament_registrations;
create policy registrations_insert
on public.tournament_registrations
for insert to authenticated
with check(
  user_id=auth.uid()
  and public.is_staff_eligible_for_tournament(tournament_id,auth.uid())
);

-- Existing team creation RPC, now eligibility-aware and ID-type safe.
-- Older UnitedBML builds used the same argument signature with a different
-- return declaration, so PostgreSQL requires the old function to be dropped.
drop function if exists public.create_tournament_team(text,text);

create function public.create_tournament_team(
  p_tournament_id text,
  p_team_name text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.tournaments;
  me public.profiles;
  s public.staff;
  team_id text;
  code text;
begin
  select * into t from public.tournaments where id::text=p_tournament_id::text;
  if t.id is null then raise exception 'Tournament not found'; end if;
  if t.status<>'Registration Open' then raise exception 'Tournament registration is not open'; end if;
  if lower(coalesce(t.tournament_mode,''))<>'teams' then raise exception 'This tournament is not using Team registration'; end if;
  if not public.is_staff_eligible_for_tournament(t.id::text,auth.uid()) then
    if public.staff_audience_for_user(auth.uid())='UNCLASSIFIED' then
      raise exception 'Your staff location classification has not yet been configured. Please contact UnitedBML.';
    end if;
    raise exception 'You are not eligible to create a team for this tournament.';
  end if;

  select * into me from public.profiles where id=auth.uid();
  select * into s from public.staff
   where (me.member_uid is not null and uid=me.member_uid)
      or lower(coalesce(email,''))=lower(coalesce(me.email,''))
   order by case when me.member_uid is not null and uid=me.member_uid then 0 else 1 end
   limit 1;

  team_id := 'TEAM-'||replace(gen_random_uuid()::text,'-','');
  code := upper(substr(regexp_replace(coalesce(p_team_name,'TEAM'),'[^A-Za-z0-9]','','g'),1,3))
          ||'-'||lpad((floor(random()*10000))::int::text,4,'0');

  insert into public.tournament_teams(
    id,tournament_id,team_name,join_code,leader_user_id,leader_uid,
    leader_name,leader_email,status
  )
  values(
    team_id,t.id::text,trim(p_team_name),code,auth.uid(),
    coalesce(me.member_uid,s.uid),
    coalesce(nullif(me.full_name,''),s.full_name,me.email),
    me.email,'Open'
  );

  insert into public.tournament_registrations(
    tournament_id,user_id,staff_uid,staff_name,email,contact_no,department,
    registration_type,team_id,status
  )
  values(
    t.id::text,auth.uid(),coalesce(me.member_uid,s.uid),
    coalesce(nullif(me.full_name,''),s.full_name,me.email),me.email,
    coalesce(me.contact_no,s.contact_no),public.staff_department_for_user(auth.uid()),
    'Team',team_id,'Approved'
  );

  return jsonb_build_object('ok',true,'team_id',team_id,'join_code',code);
end $$;

grant execute on function public.create_tournament_team(text,text) to authenticated;

-- Team leader approval must re-check current eligibility.
drop function if exists public.approve_tournament_team_request(text,text);
create function public.approve_tournament_team_request(
  p_registration_id text,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.tournament_registrations;
  leader_uid uuid;
  normalized_decision text;
begin
  select * into r
  from public.tournament_registrations
  where id::text=p_registration_id::text
  for update;

  if r.id is null then raise exception 'Registration request not found'; end if;

  select t.leader_user_id into leader_uid
  from public.tournament_teams t
  where t.id::text=r.team_id::text
  limit 1;

  if leader_uid is null then raise exception 'Team not found'; end if;
  if not public.is_committee_user() and leader_uid<>auth.uid() then
    raise exception 'Only the team leader or Committee can approve this request';
  end if;
  if r.status<>'Pending Leader Approval' then raise exception 'This request is no longer pending'; end if;

  normalized_decision:=lower(trim(coalesce(p_decision,'')));

  if normalized_decision in ('approve','approved','yes','true') then
    if not public.is_staff_eligible_for_tournament(r.tournament_id::text,r.user_id) then
      raise exception 'This staff member is no longer eligible for this tournament.';
    end if;
    update public.tournament_registrations
      set status='Approved',decided_at=now(),decided_by=auth.uid()
    where id::text=r.id::text;
    return jsonb_build_object('ok',true,'status','Approved');
  elsif normalized_decision in ('reject','rejected','no','false') then
    update public.tournament_registrations
      set status='Rejected',decided_at=now(),decided_by=auth.uid()
    where id::text=r.id::text;
    return jsonb_build_object('ok',true,'status','Rejected');
  end if;

  raise exception 'Invalid team decision: %',p_decision;
end $$;

grant execute on function public.approve_tournament_team_request(text,text) to authenticated;

-- Backfill audience_type from older JSON data if present, otherwise ALL_STAFF.
update public.events
set audience_type=case
  when upper(coalesce(data->>'audienceType','')) in ('MALE_BASED','ATOLL_BASED','ALL_STAFF')
    then upper(data->>'audienceType')
  else 'ALL_STAFF'
end
where audience_type='ALL_STAFF';

comment on table public.department_audience_map is
'Maps the staff Department master to the centralized UnitedBML event audience categories MALE_BASED and ATOLL_BASED.';
comment on column public.events.audience_type is
'Event registration eligibility authority: ALL_STAFF, MALE_BASED, or ATOLL_BASED.';
