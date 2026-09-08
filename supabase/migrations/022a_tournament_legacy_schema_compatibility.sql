-- UnitedBML focused V12 Tournament compatibility hotfix
-- Run this first if 022_simple_tournament_module.sql stopped with:
-- column t.leader_user_id does not exist

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
