-- UnitedBML V12.8 Participant & External Event Official Portal
create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- Explicit role model
-- -------------------------------------------------------------------
create or replace function public.is_committee_user()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select lower(coalesce((select role from public.profiles where id=auth.uid()),'')) in (
    'administrator','chairperson','vice chairperson','vice_chairperson','president',
    'treasurer','secretary','communications coordinator',
    'male coordinator 1','male coordinator 2','atoll coordinator','atoll representative',
    'head of total rewards & employee relations',
    'head of talent acquisition & people development',
    'head of employee experience & hr business partnering'
  )
$$;
grant execute on function public.is_committee_user() to authenticated;

create or replace function public.current_profile_email()
returns text
language sql stable security definer set search_path=public
as $$ select lower(coalesce((select email from public.profiles where id=auth.uid()),'')) $$;
grant execute on function public.current_profile_email() to authenticated;

-- -------------------------------------------------------------------
-- Event participant configuration
-- -------------------------------------------------------------------
alter table public.events add column if not exists registration_enabled boolean not null default false;
alter table public.events add column if not exists registration_mode text not null default 'None';
alter table public.events add column if not exists registration_open_at timestamptz;
alter table public.events add column if not exists registration_close_at timestamptz;
alter table public.events add column if not exists participant_rules text;
alter table public.events add column if not exists participant_capacity integer;
alter table public.events add column if not exists team_size integer;
alter table public.events add column if not exists participant_visibility text not null default 'All Staff';

create table if not exists public.event_teams (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  team_name text not null,
  leader_user_id uuid not null references auth.users(id) on delete cascade,
  leader_name text,
  leader_email text,
  join_code text not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  status text not null default 'Open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,team_name),
  unique(event_id,join_code)
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_uid text,
  staff_name text,
  email text,
  contact_no text,
  department text,
  registration_type text not null default 'Individual',
  team_id uuid references public.event_teams(id) on delete set null,
  status text not null default 'Approved',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  data jsonb not null default '{}'::jsonb,
  unique(event_id,user_id)
);

create table if not exists public.event_team_messages (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  team_id uuid not null references public.event_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.event_winners (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  position text not null,
  winner_name text not null,
  team_id uuid references public.event_teams(id) on delete set null,
  staff_uid text,
  remarks text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- External Event Officials & reimbursement submission
-- -------------------------------------------------------------------
create table if not exists public.external_event_officials (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  official_role text not null default 'Team Manager',
  notes text,
  status text not null default 'Active',
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  unique(event_id,user_id)
);

create table if not exists public.external_event_reimbursements (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  official_user_id uuid not null references auth.users(id) on delete cascade,
  official_role text,
  title text not null,
  description text,
  expense_date date not null,
  vendor_name text,
  reference_no text,
  amount numeric(14,2) not null check(amount > 0),
  supporting_document_name text,
  status text not null default 'Pending Committee Approval',
  committee_comment text,
  approved_by uuid references auth.users(id),
  approved_by_name text,
  approved_at timestamptz,
  rejected_at timestamptz,
  reimbursement_case_id text references public.reimbursement_cases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.external_reimbursement_history (
  id uuid primary key default gen_random_uuid(),
  external_reimbursement_id uuid not null references public.external_event_reimbursements(id) on delete cascade,
  action text not null,
  remarks text,
  actor_id uuid references auth.users(id),
  actor_name text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- Helpers
-- -------------------------------------------------------------------
create or replace function public.is_event_team_leader(p_team_id uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.event_teams t
    where t.id=p_team_id and t.leader_user_id=auth.uid()
  )
$$;
grant execute on function public.is_event_team_leader(uuid) to authenticated;

create or replace function public.is_event_team_member(p_team_id uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.event_registrations r
    where r.team_id=p_team_id and r.user_id=auth.uid() and r.status='Approved'
  ) or public.is_event_team_leader(p_team_id)
$$;
grant execute on function public.is_event_team_member(uuid) to authenticated;

create or replace function public.is_external_event_official(p_event_id text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.external_event_officials x
    where x.event_id=p_event_id and x.user_id=auth.uid() and x.status='Active'
  )
$$;
grant execute on function public.is_external_event_official(text) to authenticated;

create or replace function public.event_has_approved_expense(p_event_id text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.expense_requests e
    where e.event_id=p_event_id and e.status='Approved'
  )
$$;
grant execute on function public.event_has_approved_expense(text) to authenticated;

-- -------------------------------------------------------------------
-- Registration RPCs
-- -------------------------------------------------------------------
create or replace function public.self_register_event(p_event_id text, p_registration_type text default 'Individual')
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare e public.events; p public.profiles; rid uuid;
begin
  select * into e from public.events where id=p_event_id;
  if e.id is null then raise exception 'Event not found'; end if;
  if not e.registration_enabled then raise exception 'Registration is not open for this event'; end if;
  if e.registration_open_at is not null and now()<e.registration_open_at then raise exception 'Registration has not opened yet'; end if;
  if e.registration_close_at is not null and now()>e.registration_close_at then raise exception 'Registration is closed'; end if;
  if lower(coalesce(e.registration_mode,'none')) not in ('individual','teams') then raise exception 'This event does not accept registrations'; end if;
  select * into p from public.profiles where id=auth.uid();
  if p.id is null then raise exception 'Profile not found'; end if;

  insert into public.event_registrations(event_id,user_id,staff_uid,staff_name,email,contact_no,department,registration_type,status)
  values(e.id,p.id,p.member_uid,p.full_name,p.email,p.contact_no,coalesce((
    select st.data->>'department' from public.staff st
    where (p.member_uid is not null and st.uid=p.member_uid)
       or lower(coalesce(st.email,''))=lower(coalesce(p.email,''))
    limit 1
  ),''),p_registration_type,'Approved')
  on conflict(event_id,user_id) do update
    set staff_uid=excluded.staff_uid,staff_name=excluded.staff_name,email=excluded.email,
        contact_no=excluded.contact_no,registration_type=excluded.registration_type,status='Approved',
        requested_at=now()
  returning id into rid;
  return jsonb_build_object('ok',true,'registration_id',rid);
end $$;
grant execute on function public.self_register_event(text,text) to authenticated;

create or replace function public.create_event_team(p_event_id text,p_team_name text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare e public.events; p public.profiles; tid uuid;
begin
  select * into e from public.events where id=p_event_id;
  if e.id is null or not e.registration_enabled or lower(e.registration_mode)<>'teams' then
    raise exception 'Team registration is not open';
  end if;
  if e.registration_close_at is not null and now()>e.registration_close_at then raise exception 'Registration is closed'; end if;
  select * into p from public.profiles where id=auth.uid();

  insert into public.event_teams(event_id,team_name,leader_user_id,leader_name,leader_email)
  values(e.id,trim(p_team_name),auth.uid(),p.full_name,p.email)
  returning id into tid;

  insert into public.event_registrations(event_id,user_id,staff_uid,staff_name,email,contact_no,department,registration_type,team_id,status)
  values(e.id,p.id,p.member_uid,p.full_name,p.email,p.contact_no,coalesce((
    select st.data->>'department' from public.staff st
    where (p.member_uid is not null and st.uid=p.member_uid)
       or lower(coalesce(st.email,''))=lower(coalesce(p.email,''))
    limit 1
  ),''),'Team',tid,'Approved')
  on conflict(event_id,user_id) do update set registration_type='Team',team_id=tid,status='Approved';

  return jsonb_build_object('ok',true,'team_id',tid);
end $$;
grant execute on function public.create_event_team(text,text) to authenticated;

create or replace function public.request_join_event_team(p_team_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare t public.event_teams; e public.events; p public.profiles;
begin
  select * into t from public.event_teams where id=p_team_id and status='Open';
  if t.id is null then raise exception 'Team is not available'; end if;
  select * into e from public.events where id=t.event_id;
  if not e.registration_enabled or lower(e.registration_mode)<>'teams' then raise exception 'Team registration is not open'; end if;
  if e.registration_close_at is not null and now()>e.registration_close_at then raise exception 'Registration is closed'; end if;
  select * into p from public.profiles where id=auth.uid();

  insert into public.event_registrations(event_id,user_id,staff_uid,staff_name,email,contact_no,department,registration_type,team_id,status)
  values(t.event_id,p.id,p.member_uid,p.full_name,p.email,p.contact_no,coalesce((
    select st.data->>'department' from public.staff st
    where (p.member_uid is not null and st.uid=p.member_uid)
       or lower(coalesce(st.email,''))=lower(coalesce(p.email,''))
    limit 1
  ),''),'Team',t.id,'Pending Leader Approval')
  on conflict(event_id,user_id) do update set team_id=t.id,registration_type='Team',status='Pending Leader Approval',requested_at=now();

  return jsonb_build_object('ok',true);
end $$;
grant execute on function public.request_join_event_team(uuid) to authenticated;

create or replace function public.approve_event_team_join(p_registration_id uuid,p_approve boolean,p_comment text default null)
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
  update public.event_registrations
     set status=case when p_approve then 'Approved' else 'Rejected' end,
         decided_at=now(),decided_by=auth.uid(),
         data=coalesce(data,'{}'::jsonb)||jsonb_build_object('decision_comment',coalesce(p_comment,''))
   where id=r.id;
  return jsonb_build_object('ok',true,'status',case when p_approve then 'Approved' else 'Rejected' end);
end $$;
grant execute on function public.approve_event_team_join(uuid,boolean,text) to authenticated;

-- -------------------------------------------------------------------
-- External official reimbursement RPCs
-- -------------------------------------------------------------------
create or replace function public.submit_external_event_reimbursement(
  p_event_id text,p_title text,p_description text,p_expense_date date,
  p_vendor_name text,p_reference_no text,p_amount numeric,p_supporting_document_name text default null
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare e public.events; o public.external_event_officials; p public.profiles; rid uuid; approved_total numeric; used_total numeric;
begin
  if not public.is_external_event_official(p_event_id) then raise exception 'You are not assigned as an official for this event'; end if;
  if not public.event_has_approved_expense(p_event_id) then raise exception 'The event does not have an approved expense request'; end if;
  select * into e from public.events where id=p_event_id;
  select * into o from public.external_event_officials where event_id=p_event_id and user_id=auth.uid() and status='Active' limit 1;
  select * into p from public.profiles where id=auth.uid();

  select coalesce(sum(total_amount),0) into approved_total from public.expense_requests where event_id=p_event_id and status='Approved';
  select coalesce(sum(amount),0) into used_total from public.external_event_reimbursements
   where event_id=p_event_id and status in ('Pending Committee Approval','Approved for AP','AP Processing','Paid');
  if used_total + p_amount > approved_total then
    raise exception 'This reimbursement would exceed the approved event expense amount';
  end if;

  insert into public.external_event_reimbursements(
    event_id,official_user_id,official_role,title,description,expense_date,vendor_name,reference_no,amount,supporting_document_name,status
  )
  values(e.id,auth.uid(),o.official_role,trim(p_title),p_description,p_expense_date,p_vendor_name,p_reference_no,p_amount,p_supporting_document_name,'Pending Committee Approval')
  returning id into rid;

  insert into public.external_reimbursement_history(external_reimbursement_id,action,actor_id,actor_name)
  values(rid,'Submitted for Committee approval',auth.uid(),p.full_name);

  insert into public.notifications(user_id,title,message,related_type,related_id)
  select pr.id,'External event reimbursement approval',coalesce(e.name,'Event')||' · '||trim(p_title),'external_reimbursement',rid::text
  from public.profiles pr
  where lower(coalesce(pr.status,'Active'))<>'inactive'
    and lower(coalesce(pr.role,'')) in (
      'administrator','chairperson','vice chairperson','president','treasurer','secretary',
      'communications coordinator','male coordinator 1','male coordinator 2','atoll coordinator'
    );

  return jsonb_build_object('ok',true,'id',rid);
end $$;
grant execute on function public.submit_external_event_reimbursement(text,text,text,date,text,text,numeric,text) to authenticated;

create or replace function public.decide_external_event_reimbursement(p_id uuid,p_approve boolean,p_comment text default null)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare x public.external_event_reimbursements; e public.events; p public.profiles; er public.expense_requests; case_id text; case_ref text;
begin
  if not public.is_committee_user() then raise exception 'Committee approval required'; end if;
  select * into x from public.external_event_reimbursements where id=p_id for update;
  if x.id is null then raise exception 'Reimbursement request not found'; end if;
  if x.status<>'Pending Committee Approval' then raise exception 'This request is no longer pending'; end if;
  select * into e from public.events where id=x.event_id;
  select * into p from public.profiles where id=auth.uid();

  if not p_approve then
    update public.external_event_reimbursements
       set status='Rejected',committee_comment=p_comment,approved_by=auth.uid(),approved_by_name=p.full_name,rejected_at=now(),updated_at=now()
     where id=x.id;
    insert into public.external_reimbursement_history(external_reimbursement_id,action,remarks,actor_id,actor_name)
    values(x.id,'Rejected by Committee',p_comment,auth.uid(),p.full_name);
    insert into public.notifications(user_id,title,message,related_type,related_id)
    values(x.official_user_id,'Reimbursement rejected',coalesce(e.name,'Event')||' · '||x.title,'external_reimbursement',x.id::text);
    return jsonb_build_object('ok',true,'status','Rejected');
  end if;

  select * into er from public.expense_requests where event_id=x.event_id and status='Approved' order by approved_at desc nulls last,created_at desc limit 1;
  case_id := floor(extract(epoch from clock_timestamp())*1000)::bigint::text;
  case_ref := 'ER-'||to_char(current_date,'YYYY')||'-'||upper(substr(replace(x.id::text,'-',''),1,8));

  insert into public.reimbursement_cases(
    id,case_ref,reference_no,expense_request_id,expense_request_number,event_id,event_name,
    expense_item,approved_item_amount,route,status,reason,expected_expense_date,notes,requested_by,data,created_at,updated_at
  )
  values(
    case_id,case_ref,x.reference_no,er.id,er.request_number,x.event_id,e.name,
    x.title,x.amount,'External Official','Pre-Approved',x.description,x.expense_date,
    coalesce(p_comment,'')||case when x.vendor_name is not null then E'\nVendor: '||x.vendor_name else '' end,
    coalesce((select full_name from public.profiles where id=x.official_user_id),'External Official')||' — '||coalesce(x.official_role,'Team Manager'),
    jsonb_build_object('source','External Event Official','externalReimbursementId',x.id,'vendorName',x.vendor_name,'supportingDocumentName',x.supporting_document_name),
    now(),now()
  )
  on conflict(id) do nothing;

  insert into public.reimbursement_history(reimbursement_id,action,status,remarks,actor_id,actor_name)
  values(case_id,'Committee approved external official reimbursement','Pre-Approved',p_comment,auth.uid(),p.full_name);

  update public.external_event_reimbursements
     set status='Approved for AP',committee_comment=p_comment,approved_by=auth.uid(),approved_by_name=p.full_name,
         approved_at=now(),reimbursement_case_id=case_id,updated_at=now()
   where id=x.id;

  insert into public.external_reimbursement_history(external_reimbursement_id,action,remarks,actor_id,actor_name)
  values(x.id,'Approved by Committee and released to AP workflow',p_comment,auth.uid(),p.full_name);

  insert into public.notifications(user_id,title,message,related_type,related_id)
  values(x.official_user_id,'Reimbursement approved for AP',coalesce(e.name,'Event')||' · '||x.title,'external_reimbursement',x.id::text);

  insert into public.notifications(user_id,title,message,related_type,related_id)
  select pr.id,'AP submission ready',coalesce(e.name,'Event')||' · '||x.title||' · '||case_ref,'reimbursement',case_id
  from public.profiles pr
  where lower(coalesce(pr.role,''))='treasurer' and lower(coalesce(pr.status,'Active'))<>'inactive';

  return jsonb_build_object('ok',true,'status','Approved for AP','reimbursement_case_id',case_id,'case_ref',case_ref);
end $$;
grant execute on function public.decide_external_event_reimbursement(uuid,boolean,text) to authenticated;

-- -------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------
-- Make this migration safe to rerun.
do $$
declare r record;
begin
  for r in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname='public'
      and tablename in (
        'event_teams','event_registrations','event_team_messages','event_winners',
        'external_event_officials','external_event_reimbursements','external_reimbursement_history'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

alter table public.event_teams enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_team_messages enable row level security;
alter table public.event_winners enable row level security;
alter table public.external_event_officials enable row level security;
alter table public.external_event_reimbursements enable row level security;
alter table public.external_reimbursement_history enable row level security;

create policy event_teams_read on public.event_teams for select to authenticated using(public.is_active_authenticated_user());
create policy event_teams_insert on public.event_teams for insert to authenticated with check(leader_user_id=auth.uid() or public.is_committee_user());
create policy event_teams_update on public.event_teams for update to authenticated using(public.is_committee_user() or leader_user_id=auth.uid()) with check(public.is_committee_user() or leader_user_id=auth.uid());
create policy event_teams_delete on public.event_teams for delete to authenticated using(public.is_committee_user() or leader_user_id=auth.uid());

create policy event_reg_read on public.event_registrations for select to authenticated using(
  public.is_committee_user() or user_id=auth.uid() or public.is_event_team_leader(team_id) or public.is_event_team_member(team_id)
);
create policy event_reg_insert on public.event_registrations for insert to authenticated with check(user_id=auth.uid());
create policy event_reg_update on public.event_registrations for update to authenticated using(
  public.is_committee_user() or public.is_event_team_leader(team_id)
) with check(
  public.is_committee_user() or public.is_event_team_leader(team_id)
);

create policy event_team_messages_read on public.event_team_messages for select to authenticated using(
  public.is_committee_user() or public.is_event_team_member(team_id)
);
create policy event_team_messages_insert on public.event_team_messages for insert to authenticated with check(
  user_id=auth.uid() and (public.is_committee_user() or public.is_event_team_member(team_id))
);

create policy event_winners_read on public.event_winners for select to authenticated using(public.is_active_authenticated_user());
create policy event_winners_write on public.event_winners for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

create policy external_official_read on public.external_event_officials for select to authenticated using(public.is_committee_user() or user_id=auth.uid());
create policy external_official_write on public.external_event_officials for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

create policy external_reimb_read on public.external_event_reimbursements for select to authenticated using(public.is_committee_user() or official_user_id=auth.uid());
create policy external_reimb_insert on public.external_event_reimbursements for insert to authenticated with check(official_user_id=auth.uid() and public.is_external_event_official(event_id));
create policy external_reimb_update on public.external_event_reimbursements for update to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

create policy external_reimb_hist_read on public.external_reimbursement_history for select to authenticated using(
  public.is_committee_user() or exists(select 1 from public.external_event_reimbursements x where x.id=external_reimbursement_id and x.official_user_id=auth.uid())
);
create policy external_reimb_hist_write on public.external_reimbursement_history for insert to authenticated with check(public.is_committee_user() or actor_id=auth.uid());

-- -------------------------------------------------------------------
-- Tighten the legacy "all authenticated users can operate" policies.
-- Participants may read public event content but Committee retains management writes.
-- -------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'event_types','budgets','committee_members','committee_leave_history','staff',
    'event_tasks','event_task_history','event_actual_expenses',
    'meetings','meeting_attendees','meeting_agenda','meeting_decisions','meeting_actions','meeting_action_history',
    'expense_requests','expense_lines','expense_approvals','expense_reversals',
    'reimbursement_cases','reimbursement_history','ap_batches','ap_bills',
    'attachments','email_log','audit_log','app_settings'
  ]
  loop
    execute format('drop policy if exists active_user_read on public.%I',t);
    execute format('drop policy if exists active_user_write on public.%I',t);
    execute format('drop policy if exists participant_read on public.%I',t);
    execute format('drop policy if exists committee_manage on public.%I',t);
    execute format('create policy committee_manage on public.%I for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user())',t);
  end loop;
end $$;

drop policy if exists active_user_read on public.events;
drop policy if exists active_user_write on public.events;
drop policy if exists participant_events_read on public.events;
drop policy if exists committee_events_manage on public.events;
create policy participant_events_read on public.events for select to authenticated using(public.is_active_authenticated_user());
create policy committee_events_manage on public.events for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

drop policy if exists active_user_read on public.event_attendance;
drop policy if exists active_user_write on public.event_attendance;
drop policy if exists event_attendance_scoped_read on public.event_attendance;
drop policy if exists event_attendance_committee_write on public.event_attendance;
create policy event_attendance_scoped_read on public.event_attendance for select to authenticated using(
  public.is_committee_user()
  or staff_uid=coalesce((select member_uid from public.profiles where id=auth.uid()),'')
);
create policy event_attendance_committee_write on public.event_attendance for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

-- V12.8.1 compatibility fix:
-- external_reimbursement_history uses column external_reimbursement_id.

-- External officials can read only reimbursement cases created from their submissions.
drop policy if exists committee_manage on public.reimbursement_cases;
drop policy if exists reimbursement_case_read_scoped on public.reimbursement_cases;
drop policy if exists reimbursement_case_committee_write on public.reimbursement_cases;
create policy reimbursement_case_read_scoped on public.reimbursement_cases for select to authenticated using(
  public.is_committee_user()
  or exists(
    select 1 from public.external_event_reimbursements x
    where x.reimbursement_case_id=reimbursement_cases.id and x.official_user_id=auth.uid()
  )
);
create policy reimbursement_case_committee_write on public.reimbursement_cases for all to authenticated
using(public.is_committee_user()) with check(public.is_committee_user());

drop policy if exists committee_manage on public.reimbursement_history;
drop policy if exists reimbursement_history_read_scoped on public.reimbursement_history;
drop policy if exists reimbursement_history_committee_write on public.reimbursement_history;
create policy reimbursement_history_read_scoped on public.reimbursement_history for select to authenticated using(
  public.is_committee_user()
  or exists(
    select 1 from public.external_event_reimbursements x
    where x.reimbursement_case_id=reimbursement_history.reimbursement_id and x.official_user_id=auth.uid()
  )
);
create policy reimbursement_history_committee_write on public.reimbursement_history for all to authenticated
using(public.is_committee_user()) with check(public.is_committee_user());

drop policy if exists committee_manage on public.ap_batches;
drop policy if exists ap_batches_read_scoped on public.ap_batches;
drop policy if exists ap_batches_committee_write on public.ap_batches;
create policy ap_batches_read_scoped on public.ap_batches for select to authenticated using(
  public.is_committee_user()
  or exists(
    select 1 from public.external_event_reimbursements x
    where x.reimbursement_case_id=ap_batches.reimbursement_id and x.official_user_id=auth.uid()
  )
);
create policy ap_batches_committee_write on public.ap_batches for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

drop policy if exists committee_manage on public.ap_bills;
drop policy if exists ap_bills_read_scoped on public.ap_bills;
drop policy if exists ap_bills_committee_write on public.ap_bills;
create policy ap_bills_read_scoped on public.ap_bills for select to authenticated using(
  public.is_committee_user()
  or exists(
    select 1 from public.ap_batches b
    join public.external_event_reimbursements x on x.reimbursement_case_id=b.reimbursement_id
    where b.id=ap_bills.ap_batch_id and x.official_user_id=auth.uid()
  )
);
create policy ap_bills_committee_write on public.ap_bills for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

comment on table public.external_event_reimbursements is
'External official submissions require Committee approval; approval creates a Pre-Approved reimbursement_cases row which then uses the existing AP batch workflow.';


-- Personal notifications must remain private.
drop policy if exists auth_read on public.notifications;
drop policy if exists committee_read on public.notifications;
drop policy if exists committee_write on public.notifications;
drop policy if exists active_user_read on public.notifications;
drop policy if exists active_user_write on public.notifications;
drop policy if exists notification_read on public.notifications;
drop policy if exists notification_update on public.notifications;
create policy notification_read on public.notifications for select to authenticated using(user_id=auth.uid() or public.is_committee_user());
create policy notification_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Vendor master remains a management-only resource.
drop policy if exists vendor_master_read_authenticated on public.vendor_master;
drop policy if exists vendor_master_insert_authorized on public.vendor_master;
drop policy if exists vendor_master_update_authorized on public.vendor_master;
drop policy if exists vendor_master_delete_authorized on public.vendor_master;
drop policy if exists active_user_read on public.vendor_master;
drop policy if exists active_user_write on public.vendor_master;
drop policy if exists vendor_master_committee on public.vendor_master;
create policy vendor_master_committee on public.vendor_master for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());
