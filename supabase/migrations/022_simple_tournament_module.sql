-- UnitedBML V12 - Simple Tournament Module
-- Focused scope: auto-provision from approved event expenses, staff registration,
-- teams, private team discussion, match schedules, live updates, winners and stats.

create extension if not exists pgcrypto;

create table if not exists public.tournaments (
  id text primary key,
  event_id text not null unique references public.events(id) on delete cascade,
  source_expense_request_id text references public.expense_requests(id) on delete set null,
  name text not null,
  tournament_mode text not null default 'Individual' check (tournament_mode in ('Individual','Teams')),
  sport text,
  rules text,
  status text not null default 'Setup' check (status in ('Setup','Registration Open','Registration Closed','Scheduled','Live','Completed','Cancelled')),
  registration_open date,
  registration_close date,
  start_date date,
  end_date date,
  venue text,
  max_participants integer,
  max_teams integer,
  team_size integer,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_teams (
  id text primary key,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  team_name text not null,
  join_code text not null,
  leader_user_id uuid not null references auth.users(id) on delete cascade,
  leader_uid text,
  leader_name text not null,
  leader_email text,
  status text not null default 'Open' check (status in ('Open','Full','Closed','Withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tournament_id,team_name),
  unique(tournament_id,join_code)
);

create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_uid text,
  staff_name text not null,
  email text,
  contact_no text,
  department text,
  registration_type text not null check (registration_type in ('Individual','Team')),
  team_id text references public.tournament_teams(id) on delete set null,
  status text not null default 'Approved' check (status in ('Pending Leader Approval','Approved','Rejected','Withdrawn')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  data jsonb not null default '{}'::jsonb,
  unique(tournament_id,user_id)
);

create table if not exists public.tournament_team_messages (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  team_id text not null references public.tournament_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_updates (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  update_type text not null default 'Update',
  title text not null,
  message text not null,
  is_pinned boolean not null default false,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_matches (
  id text primary key,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  match_no integer,
  stage text,
  match_date date,
  match_time time,
  venue text,
  team_a text,
  team_b text,
  participant_a text,
  participant_b text,
  score_a numeric,
  score_b numeric,
  status text not null default 'Scheduled' check (status in ('Scheduled','Live','Completed','Postponed','Cancelled')),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_winners (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  position text not null,
  winner_name text not null,
  team_id text references public.tournament_teams(id) on delete set null,
  staff_uid text,
  remarks text,
  created_at timestamptz not null default now(),
  unique(tournament_id,position)
);


-- -------------------------------------------------------------------
-- Compatibility upgrade for projects that previously ran older
-- Tournament migrations. CREATE TABLE IF NOT EXISTS does not add new
-- columns to an existing table, so add every focused-V12 column safely.
-- -------------------------------------------------------------------

alter table public.tournaments add column if not exists event_id text;
alter table public.tournaments add column if not exists source_expense_request_id text;
alter table public.tournaments add column if not exists tournament_mode text default 'Individual';
alter table public.tournaments add column if not exists sport text;
alter table public.tournaments add column if not exists rules text;
alter table public.tournaments add column if not exists registration_open date;
alter table public.tournaments add column if not exists registration_close date;
alter table public.tournaments add column if not exists start_date date;
alter table public.tournaments add column if not exists end_date date;
alter table public.tournaments add column if not exists venue text;
alter table public.tournaments add column if not exists max_participants integer;
alter table public.tournaments add column if not exists max_teams integer;
alter table public.tournaments add column if not exists team_size integer;
alter table public.tournaments add column if not exists data jsonb default '{}'::jsonb;
alter table public.tournaments add column if not exists created_at timestamptz default now();
alter table public.tournaments add column if not exists updated_at timestamptz default now();

alter table public.tournament_teams add column if not exists join_code text;
alter table public.tournament_teams add column if not exists leader_user_id uuid;
alter table public.tournament_teams add column if not exists leader_uid text;
alter table public.tournament_teams add column if not exists leader_name text;
alter table public.tournament_teams add column if not exists leader_email text;
alter table public.tournament_teams add column if not exists status text default 'Open';
alter table public.tournament_teams add column if not exists created_at timestamptz default now();
alter table public.tournament_teams add column if not exists updated_at timestamptz default now();

alter table public.tournament_registrations add column if not exists user_id uuid;
alter table public.tournament_registrations add column if not exists staff_uid text;
alter table public.tournament_registrations add column if not exists staff_name text;
alter table public.tournament_registrations add column if not exists email text;
alter table public.tournament_registrations add column if not exists contact_no text;
alter table public.tournament_registrations add column if not exists department text;
alter table public.tournament_registrations add column if not exists registration_type text;
alter table public.tournament_registrations add column if not exists team_id text;
alter table public.tournament_registrations add column if not exists status text default 'Approved';
alter table public.tournament_registrations add column if not exists requested_at timestamptz default now();
alter table public.tournament_registrations add column if not exists decided_at timestamptz;
alter table public.tournament_registrations add column if not exists decided_by uuid;
alter table public.tournament_registrations add column if not exists data jsonb default '{}'::jsonb;

alter table public.tournament_matches add column if not exists match_no integer;
alter table public.tournament_matches add column if not exists stage text;
alter table public.tournament_matches add column if not exists match_date date;
alter table public.tournament_matches add column if not exists match_time time;
alter table public.tournament_matches add column if not exists venue text;
alter table public.tournament_matches add column if not exists team_a text;
alter table public.tournament_matches add column if not exists team_b text;
alter table public.tournament_matches add column if not exists participant_a text;
alter table public.tournament_matches add column if not exists participant_b text;
alter table public.tournament_matches add column if not exists score_a numeric;
alter table public.tournament_matches add column if not exists score_b numeric;
alter table public.tournament_matches add column if not exists status text default 'Scheduled';
alter table public.tournament_matches add column if not exists remarks text;
alter table public.tournament_matches add column if not exists created_at timestamptz default now();
alter table public.tournament_matches add column if not exists updated_at timestamptz default now();

alter table public.tournament_updates add column if not exists update_type text default 'Update';
alter table public.tournament_updates add column if not exists title text;
alter table public.tournament_updates add column if not exists message text;
alter table public.tournament_updates add column if not exists is_pinned boolean default false;
alter table public.tournament_updates add column if not exists created_by uuid;
alter table public.tournament_updates add column if not exists created_by_name text;
alter table public.tournament_updates add column if not exists created_at timestamptz default now();

alter table public.tournament_winners add column if not exists position text;
alter table public.tournament_winners add column if not exists winner_name text;
alter table public.tournament_winners add column if not exists team_id text;
alter table public.tournament_winners add column if not exists staff_uid text;
alter table public.tournament_winners add column if not exists remarks text;
alter table public.tournament_winners add column if not exists created_at timestamptz default now();

alter table public.tournament_team_messages add column if not exists tournament_id text;
alter table public.tournament_team_messages add column if not exists team_id text;
alter table public.tournament_team_messages add column if not exists user_id uuid;
alter table public.tournament_team_messages add column if not exists sender_name text;
alter table public.tournament_team_messages add column if not exists message text;
alter table public.tournament_team_messages add column if not exists created_at timestamptz default now();


do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournaments' and column_name='source_event_id') then
    execute 'update public.tournaments set event_id=coalesce(event_id,source_event_id) where event_id is null';
  end if;

  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_teams' and column_name='captain_name') then
    execute 'update public.tournament_teams set leader_name=coalesce(leader_name,captain_name) where leader_name is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_teams' and column_name='captain_email') then
    execute 'update public.tournament_teams set leader_email=coalesce(leader_email,captain_email) where leader_email is null';
  end if;

  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_registrations' and column_name='player_name') then
    execute 'update public.tournament_registrations set staff_name=coalesce(staff_name,player_name) where staff_name is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_registrations' and column_name='registered_at') then
    execute 'update public.tournament_registrations set requested_at=coalesce(requested_at,registered_at) where requested_at is null';
  end if;

  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_matches' and column_name='fixture_date') then
    execute 'update public.tournament_matches set match_date=coalesce(match_date,fixture_date) where match_date is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_matches' and column_name='fixture_time') then
    execute 'update public.tournament_matches set match_time=coalesce(match_time,fixture_time) where match_time is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_matches' and column_name='court') then
    execute 'update public.tournament_matches set venue=coalesce(venue,court) where venue is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_matches' and column_name='round_name') then
    execute 'update public.tournament_matches set stage=coalesce(stage,round_name) where stage is null';
  end if;

end $$;

update public.tournament_teams t
set leader_user_id=p.id
from public.profiles p
where t.leader_user_id is null
  and t.leader_email is not null
  and lower(p.email)=lower(t.leader_email);

update public.tournament_registrations r
set user_id=p.id
from public.profiles p
where r.user_id is null
  and r.email is not null
  and lower(p.email)=lower(r.email);

-- Legacy registration schemas may still contain NOT NULL columns used by
-- older Tournament modules (for example player_name). The focused V12
-- module writes staff_name instead, so make those old columns optional
-- and keep staff_name/player_name synchronized when both exist.
do $$
begin
  if exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='tournament_registrations'
      and column_name='player_name'
  ) then
    execute 'alter table public.tournament_registrations alter column player_name drop not null';
    execute 'update public.tournament_registrations set staff_name=coalesce(staff_name,player_name) where staff_name is null';
    execute 'update public.tournament_registrations set player_name=coalesce(player_name,staff_name) where player_name is null';
  end if;

  if exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='tournament_registrations'
      and column_name='registered_at'
  ) then
    execute 'alter table public.tournament_registrations alter column registered_at drop not null';
  end if;

  if exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='tournament_registrations'
      and column_name='registration_mode'
  ) then
    execute 'alter table public.tournament_registrations alter column registration_mode drop not null';
  end if;

  if exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='tournament_registrations'
      and column_name='registered_by'
  ) then
    execute 'alter table public.tournament_registrations alter column registered_by drop not null';
  end if;
end $$;

-- Keep legacy player_name populated automatically on new focused-V12
-- registrations when that old column still exists.
create or replace function public.sync_focused_tournament_registration_legacy_fields()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.staff_name is null then
    begin
      new.staff_name := new.player_name;
    exception when undefined_column then null;
    end;
  end if;

  begin
    if new.player_name is null then new.player_name := new.staff_name; end if;
  exception when undefined_column then null;
  end;

  begin
    if new.registered_at is null then new.registered_at := coalesce(new.requested_at,now()); end if;
  exception when undefined_column then null;
  end;

  return new;
end $$;

drop trigger if exists trg_sync_focused_tournament_registration_legacy_fields
  on public.tournament_registrations;

create trigger trg_sync_focused_tournament_registration_legacy_fields
before insert or update on public.tournament_registrations
for each row execute function public.sync_focused_tournament_registration_legacy_fields();


do $$
declare typ text;
begin
  select data_type into typ
  from information_schema.columns
  where table_schema='public'
    and table_name='tournament_registrations'
    and column_name='id';

  if typ='text' then
    execute 'alter table public.tournament_registrations alter column id set default replace(gen_random_uuid()::text,''-'','''')';
  elsif typ='uuid' then
    execute 'alter table public.tournament_registrations alter column id set default gen_random_uuid()';
  end if;
end $$;

do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype='c'
      and conrelid in (
        'public.tournaments'::regclass,
        'public.tournament_teams'::regclass,
        'public.tournament_registrations'::regclass,
        'public.tournament_matches'::regclass
      )
      and (
        pg_get_constraintdef(oid) ilike '%status%'
        or pg_get_constraintdef(oid) ilike '%tournament_mode%'
        or pg_get_constraintdef(oid) ilike '%registration_type%'
      )
  loop
    execute format('alter table %s drop constraint if exists %I',r.tbl,r.conname);
  end loop;
end $$;

do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournaments' and column_name='tournament_type') then
    execute 'alter table public.tournaments alter column tournament_type set default ''Internal''';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournaments' and column_name='competition_format') then
    execute 'alter table public.tournaments alter column competition_format drop not null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournaments' and column_name='category') then
    execute 'alter table public.tournaments alter column category drop not null';
  end if;
end $$;

create unique index if not exists tournaments_focused_event_unique
  on public.tournaments(event_id)
  where event_id is not null;

create unique index if not exists tournament_teams_focused_name_unique
  on public.tournament_teams(tournament_id,team_name)
  where team_name is not null;

create unique index if not exists tournament_teams_focused_code_unique
  on public.tournament_teams(tournament_id,join_code)
  where join_code is not null;

create unique index if not exists tournament_registrations_focused_user_unique
  on public.tournament_registrations(tournament_id,user_id)
  where user_id is not null;


-- Helpers for scoped team privacy.
create or replace function public.current_profile_email()
returns text language sql stable security definer set search_path=public as $$
  select lower(coalesce((select email from public.profiles where id=auth.uid()),''))
$$;

create or replace function public.is_tournament_team_leader(p_team_id text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.tournament_teams t
    where t.id::text=p_team_id::text
      and (
        t.leader_user_id=auth.uid()
        or lower(coalesce(t.leader_email,''))=public.current_profile_email()
      )
  )
$$;

create or replace function public.is_tournament_team_member(p_team_id text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.tournament_registrations r
    where r.team_id::text=p_team_id::text
      and (
        r.user_id=auth.uid()
        or lower(coalesce(r.email,''))=public.current_profile_email()
      )
      and r.status='Approved'
  ) or public.is_tournament_team_leader(p_team_id)
$$;

grant execute on function public.is_tournament_team_leader(text) to authenticated;
grant execute on function public.is_tournament_team_member(text) to authenticated;

-- Auto-provision eligible tournament events when the linked expense becomes Approved.
create or replace function public.is_tournament_event(p_event_id text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.events e
    where e.id=p_event_id and (
      coalesce((e.data->>'isTournament')::boolean,false)
      or lower(coalesce(e.event_type,'')) ~ '(tournament|sports|sport|competition|futsal|football|basketball|volleyball|badminton|table tennis|carrom|e-sport|esport|fishing|masrace)'
      or lower(coalesce(e.name,'')) ~ '(tournament|showdown|cup|league|futsal|football|basketball|volleyball|badminton|table tennis|carrom|e-sport|esport|masrace|fishing)'
    )
  )
$$;

create or replace function public.provision_simple_tournament_from_approved_expense()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  e public.events;
  tid text;
begin
  if new.status='Approved'
     and (tg_op='INSERT' or coalesce(old.status,'')<>'Approved')
     and new.event_id is not null
     and public.is_tournament_event(new.event_id) then

    select * into e from public.events where id=new.event_id;
    tid := 'TRN-' || regexp_replace(new.event_id,'[^A-Za-z0-9_-]','','g');

    if not exists(select 1 from public.tournaments where event_id=new.event_id) then
      insert into public.tournaments(
        id,event_id,source_expense_request_id,name,status,start_date,end_date,venue,data
      ) values (
        tid,new.event_id,new.id,e.name,'Setup',e.event_date,e.event_date,e.venue,
        jsonb_build_object('autoCreated',true,'expenseRequestId',new.id,'eventType',e.event_type)
      );
      insert into public.tournament_updates(tournament_id,update_type,title,message,is_pinned,created_by_name)
      values(tid,'Timeline','Tournament created','Approved event expenses created this tournament workspace automatically.',true,'System');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_provision_simple_tournament on public.expense_requests;
create trigger trg_provision_simple_tournament
after insert or update of status on public.expense_requests
for each row execute function public.provision_simple_tournament_from_approved_expense();

-- Backfill eligible events that already have an approved expense request.
do $$
declare r record;
begin
  for r in
    select distinct er.event_id,er.id as expense_id
    from public.expense_requests er
    where er.status='Approved' and er.event_id is not null and public.is_tournament_event(er.event_id)
  loop
    if not exists(select 1 from public.tournaments where event_id=r.event_id) then
      insert into public.tournaments(id,event_id,source_expense_request_id,name,status,start_date,end_date,venue,data)
      select 'TRN-'||regexp_replace(e.id,'[^A-Za-z0-9_-]','','g'),e.id,r.expense_id,e.name,'Setup',e.event_date,e.event_date,e.venue,
             jsonb_build_object('autoCreated',true,'expenseRequestId',r.expense_id,'eventType',e.event_type)
      from public.events e where e.id=r.event_id;
    end if;
  end loop;
end $$;

-- Atomic leader approval of a team join request.
create or replace function public.approve_tournament_team_request(p_registration_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r public.tournament_registrations;
  team public.tournament_teams;
begin
  select * into r from public.tournament_registrations where id=p_registration_id for update;
  if r.id is null then raise exception 'Registration request not found'; end if;
  select * into team from public.tournament_teams where id::text=r.team_id::text for update;
  if team.id is null then raise exception 'Team not found'; end if;
  if not public.is_committee_user() and team.leader_user_id<>auth.uid() then
    raise exception 'Only the team leader or Committee can approve this request';
  end if;
  if r.status<>'Pending Leader Approval' then
    raise exception 'This request is no longer pending';
  end if;
  if lower(trim(p_decision)) in ('approve','approved','yes','true') then
    update public.tournament_registrations set status='Approved',decided_at=now(),decided_by=auth.uid() where id=r.id;
    return jsonb_build_object('ok',true,'status','Approved');
  else
    update public.tournament_registrations set status='Rejected',decided_at=now(),decided_by=auth.uid() where id=r.id;
    return jsonb_build_object('ok',true,'status','Rejected');
  end if;
end $$;
grant execute on function public.approve_tournament_team_request(uuid,text) to authenticated;

-- RLS
-- Remove policies left by older Tournament versions so focused-V12
-- privacy rules are authoritative.
do $$
declare r record;
begin
  for r in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname='public'
      and tablename in (
        'tournaments','tournament_teams','tournament_registrations',
        'tournament_team_messages','tournament_updates',
        'tournament_matches','tournament_winners'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.tournament_team_messages enable row level security;
alter table public.tournament_updates enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_winners enable row level security;

-- Tournament / schedules / public live content are visible to all active authenticated users.
create policy tournament_read on public.tournaments for select to authenticated using(public.is_active_authenticated_user());
create policy tournament_committee_write on public.tournaments for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

create policy teams_read on public.tournament_teams for select to authenticated using(public.is_active_authenticated_user());
create policy teams_create on public.tournament_teams for insert to authenticated with check(public.is_active_authenticated_user() and (leader_user_id=auth.uid() or lower(coalesce(leader_email,''))=public.current_profile_email()));
create policy teams_update on public.tournament_teams for update to authenticated using(public.is_committee_user() or public.is_tournament_team_leader(id)) with check(public.is_committee_user() or leader_user_id=auth.uid() or lower(coalesce(leader_email,''))=public.current_profile_email());

create policy registrations_read on public.tournament_registrations for select to authenticated using(
  public.is_committee_user()
  or user_id=auth.uid()
  or lower(coalesce(email,''))=public.current_profile_email()
  or public.is_tournament_team_leader(team_id)
  or (status='Approved' and public.is_tournament_team_member(team_id))
);
create policy registrations_insert on public.tournament_registrations for insert to authenticated with check(public.is_active_authenticated_user() and (user_id=auth.uid() or lower(coalesce(email,''))=public.current_profile_email()));
create policy registrations_self_update on public.tournament_registrations for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy team_messages_read on public.tournament_team_messages for select to authenticated using(
  public.is_committee_user() or public.is_tournament_team_member(team_id)
);
create policy team_messages_insert on public.tournament_team_messages for insert to authenticated with check(
  user_id=auth.uid() and (public.is_committee_user() or public.is_tournament_team_member(team_id))
);

create policy updates_read on public.tournament_updates for select to authenticated using(public.is_active_authenticated_user());
create policy updates_write on public.tournament_updates for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

create policy matches_read on public.tournament_matches for select to authenticated using(public.is_active_authenticated_user());
create policy matches_write on public.tournament_matches for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

create policy winners_read on public.tournament_winners for select to authenticated using(public.is_active_authenticated_user());
create policy winners_write on public.tournament_winners for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());

-- Realtime publication: ignore duplicate-object errors where table was already added.
do $$ begin
  alter publication supabase_realtime add table public.tournament_updates;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tournament_matches;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tournament_registrations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tournament_team_messages;
exception when duplicate_object then null; end $$;

-- Privacy-safe aggregate statistics available to all authenticated users.
create or replace function public.get_tournament_public_stats(p_tournament_id text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'registrations',(select count(*) from public.tournament_registrations r where r.tournament_id=p_tournament_id and r.status='Approved'),
    'pending',(select count(*) from public.tournament_registrations r where r.tournament_id=p_tournament_id and r.status='Pending Leader Approval'),
    'teams',(select count(*) from public.tournament_teams t where t.tournament_id=p_tournament_id and t.status<>'Withdrawn'),
    'teamCounts',coalesce((select jsonb_agg(jsonb_build_object('teamId',x.team_id,'count',x.cnt)) from (
      select r.team_id,count(*) cnt from public.tournament_registrations r where r.tournament_id=p_tournament_id and r.team_id is not null and r.status='Approved' group by r.team_id
    ) x),'[]'::jsonb),
    'completedMatches',(select count(*) from public.tournament_matches m where m.tournament_id=p_tournament_id and m.status='Completed'),
    'departments',coalesce((select jsonb_agg(jsonb_build_object('department',x.department,'count',x.cnt) order by x.cnt desc) from (
      select coalesce(nullif(r.department,''),'Unspecified') department,count(*) cnt
      from public.tournament_registrations r
      where r.tournament_id=p_tournament_id and r.status='Approved'
      group by coalesce(nullif(r.department,''),'Unspecified')
    ) x),'[]'::jsonb)
  )
$$;
grant execute on function public.get_tournament_public_stats(text) to authenticated;

-- Also provision when an eligible Event itself moves to Approved, even if it has no expense request.
create or replace function public.provision_simple_tournament_from_approved_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare tid text;
begin
  if lower(coalesce(new.status,''))='approved'
     and (tg_op='INSERT' or lower(coalesce(old.status,''))<>'approved')
     and public.is_tournament_event(new.id) then
    tid := 'TRN-' || regexp_replace(new.id,'[^A-Za-z0-9_-]','','g');
    if not exists(select 1 from public.tournaments where event_id=new.id) then
      insert into public.tournaments(id,event_id,name,status,start_date,end_date,venue,data)
      values(tid,new.id,new.name,'Setup',new.event_date,new.event_date,new.venue,jsonb_build_object('autoCreated',true,'eventApproved',true,'eventType',new.event_type));
      insert into public.tournament_updates(tournament_id,update_type,title,message,is_pinned,created_by_name)
      values(tid,'Timeline','Tournament created','Approved event created this tournament workspace automatically.',true,'System');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_provision_simple_tournament_event on public.events;
create trigger trg_provision_simple_tournament_event
after insert or update of status on public.events
for each row execute function public.provision_simple_tournament_from_approved_event();

-- Registrations are created by the staff member; team leaders approve through the protected RPC.
drop policy if exists registrations_self_update on public.tournament_registrations;

-- Atomic team creation: team creator becomes leader and approved member.
create or replace function public.create_tournament_team(p_tournament_id text, p_team_name text)
returns public.tournament_teams
language plpgsql security definer set search_path=public as $$
declare
  me public.profiles;
  s public.staff;
  team public.tournament_teams;
  code text;
  team_id text;
  mode text;
  tstatus text;
begin
  select * into me from public.profiles where id=auth.uid();
  if me.id is null or lower(coalesce(me.status,'Active'))='inactive' then raise exception 'Active UnitedBML login required'; end if;
  select tournament_mode,status into mode,tstatus from public.tournaments where id=p_tournament_id;
  if mode<>'Teams' then raise exception 'This tournament is not in Team registration mode'; end if;
  if tstatus<>'Registration Open' then raise exception 'Tournament registration is not open'; end if;
  if exists(select 1 from public.tournament_registrations where tournament_id=p_tournament_id and user_id=auth.uid()) then raise exception 'You already have a registration for this tournament'; end if;

  select * into s from public.staff where lower(email)=lower(me.email) limit 1;
  team_id := 'TEAM-' || replace(gen_random_uuid()::text,'-','');
  code := upper(left(regexp_replace(coalesce(p_team_name,'TEAM'),'[^A-Za-z]','','g'),3)) || '-' || lpad((floor(random()*9000)+1000)::int::text,4,'0');

  insert into public.tournament_teams(id,tournament_id,team_name,join_code,leader_user_id,leader_uid,leader_name,leader_email,status)
  values(team_id,p_tournament_id,trim(p_team_name),code,auth.uid(),coalesce(me.member_uid,s.uid),coalesce(nullif(me.full_name,''),s.full_name,me.email),me.email,'Open')
  returning * into team;

  insert into public.tournament_registrations(tournament_id,user_id,staff_uid,staff_name,email,contact_no,department,registration_type,team_id,status)
  values(p_tournament_id,auth.uid(),coalesce(me.member_uid,s.uid),coalesce(nullif(me.full_name,''),s.full_name,me.email),me.email,coalesce(me.contact_no,s.contact_no),coalesce(s.data->>'department',s.data->>'unit',s.data->>'branch'),'Team',team_id,'Approved');

  return team;
end $$;
grant execute on function public.create_tournament_team(text,text) to authenticated;

-- Tighten direct registration insert so staff cannot register after closure.
drop policy if exists registrations_insert on public.tournament_registrations;
create policy registrations_insert on public.tournament_registrations for insert to authenticated with check(
  public.is_active_authenticated_user()
  and user_id=auth.uid()
  and exists(select 1 from public.tournaments t where t.id=tournament_id and t.status='Registration Open')
);
