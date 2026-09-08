-- UnitedBML focused V12 Tournament V12.2 compatibility hotfix
-- Run this first if the Tournament module reports:
-- column tournament_matches.match_date does not exist

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

do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_matches' and column_name='fixture_date') then
    execute 'update public.tournament_matches set match_date=coalesce(match_date,fixture_date) where match_date is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_matches' and column_name='fixture_time') then
    execute 'update public.tournament_matches set match_time=coalesce(match_time,fixture_time) where match_time is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tournament_matches' and column_name='court') then
    execute 'update public.tournament_matches set venue=coalesce(venue,court) where venue is null';
  end if;
end $$;
