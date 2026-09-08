-- UnitedBML V12.8.2
-- Event <-> Tournament shared-detail synchronization.

-- Shared fields:
-- Event name/date/venue, Tournament registration mode/status/dates,
-- participant rules/capacity/team size and winners.

alter table public.event_winners
  add column if not exists source_tournament_winner_id uuid;

create unique index if not exists event_winners_source_tournament_unique
  on public.event_winners(source_tournament_winner_id)
  where source_tournament_winner_id is not null;

-- Tournament -> linked Event.
create or replace function public.sync_event_from_tournament()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  reg_enabled boolean;
  reg_open_ts timestamptz;
  reg_close_ts timestamptz;
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.event_id is null then return new; end if;

  reg_enabled := new.status = 'Registration Open';

  reg_open_ts := case
    when new.registration_open is null then null
    else (new.registration_open::text || ' 00:00:00+05')::timestamptz
  end;

  reg_close_ts := case
    when new.registration_close is null then null
    else (new.registration_close::text || ' 23:59:59+05')::timestamptz
  end;

  update public.events e
     set name = coalesce(nullif(new.name,''),e.name),
         event_date = coalesce(new.start_date,e.event_date),
         venue = coalesce(nullif(new.venue,''),e.venue),
         expected_participants = coalesce(new.max_participants,e.expected_participants),
         registration_enabled = reg_enabled,
         registration_mode = coalesce(nullif(new.tournament_mode,''),'None'),
         registration_open_at = reg_open_ts,
         registration_close_at = reg_close_ts,
         participant_rules = new.rules,
         participant_capacity = new.max_participants,
         team_size = new.team_size,
         data = coalesce(e.data,'{}'::jsonb) || jsonb_build_object(
           'linkedTournamentId',new.id,
           'tournamentStatus',new.status,
           'tournamentSport',new.sport,
           'tournamentEndDate',new.end_date,
           'tournamentMaxTeams',new.max_teams
         ),
         updated_at = now()
   where e.id = new.event_id;

  return new;
end $$;

drop trigger if exists trg_sync_event_from_tournament on public.tournaments;
create trigger trg_sync_event_from_tournament
after insert or update of
  name,tournament_mode,sport,rules,status,registration_open,registration_close,
  start_date,end_date,venue,max_participants,max_teams,team_size
on public.tournaments
for each row execute function public.sync_event_from_tournament();

-- Event -> Tournament.
-- Event status itself remains lifecycle-derived by the Events module.
-- Only the tournament's registration state is adjusted from participant settings.
create or replace function public.sync_tournament_from_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;

  update public.tournaments t
     set name = coalesce(nullif(new.name,''),t.name),
         venue = coalesce(nullif(new.venue,''),t.venue),
         start_date = coalesce(new.event_date,t.start_date),
         tournament_mode = case
           when new.registration_mode in ('Individual','Teams') then new.registration_mode
           else t.tournament_mode
         end,
         rules = coalesce(new.participant_rules,t.rules),
         registration_open = case when new.registration_open_at is null then t.registration_open else new.registration_open_at::date end,
         registration_close = case when new.registration_close_at is null then t.registration_close else new.registration_close_at::date end,
         max_participants = coalesce(new.participant_capacity,new.expected_participants,t.max_participants),
         team_size = coalesce(new.team_size,t.team_size),
         status = case
           when t.status in ('Setup','Registration Open','Registration Closed') and new.registration_enabled then 'Registration Open'
           when t.status = 'Registration Open' and not new.registration_enabled then 'Registration Closed'
           else t.status
         end,
         updated_at = now()
   where t.event_id = new.id;

  return new;
end $$;

drop trigger if exists trg_sync_tournament_from_event on public.events;
create trigger trg_sync_tournament_from_event
after update of
  name,event_date,venue,expected_participants,registration_enabled,registration_mode,
  registration_open_at,registration_close_at,participant_rules,participant_capacity,team_size
on public.events
for each row execute function public.sync_tournament_from_event();

-- Tournament winners also appear in the Event/Participant Portal result view.
create or replace function public.sync_event_winner_from_tournament()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  linked_event text;
begin
  if tg_op='DELETE' then
    delete from public.event_winners where source_tournament_winner_id=old.id;
    return old;
  end if;

  select event_id into linked_event from public.tournaments where id=new.tournament_id;
  if linked_event is null then return new; end if;

  insert into public.event_winners(
    event_id,position,winner_name,staff_uid,remarks,source_tournament_winner_id
  )
  values(
    linked_event,new.position,new.winner_name,new.staff_uid,new.remarks,new.id
  )
  on conflict(source_tournament_winner_id)
  where source_tournament_winner_id is not null
  do update set
    event_id=excluded.event_id,
    position=excluded.position,
    winner_name=excluded.winner_name,
    staff_uid=excluded.staff_uid,
    remarks=excluded.remarks;

  return new;
end $$;

drop trigger if exists trg_sync_event_winner_from_tournament on public.tournament_winners;
create trigger trg_sync_event_winner_from_tournament
after insert or update or delete on public.tournament_winners
for each row execute function public.sync_event_winner_from_tournament();

-- Backfill current linked Tournaments into Event participant settings.
update public.events e
   set name=coalesce(nullif(t.name,''),e.name),
       event_date=coalesce(t.start_date,e.event_date),
       venue=coalesce(nullif(t.venue,''),e.venue),
       expected_participants=coalesce(t.max_participants,e.expected_participants),
       registration_enabled=(t.status='Registration Open'),
       registration_mode=t.tournament_mode,
       registration_open_at=case when t.registration_open is null then null else (t.registration_open::text||' 00:00:00+05')::timestamptz end,
       registration_close_at=case when t.registration_close is null then null else (t.registration_close::text||' 23:59:59+05')::timestamptz end,
       participant_rules=t.rules,
       participant_capacity=t.max_participants,
       team_size=t.team_size,
       data=coalesce(e.data,'{}'::jsonb)||jsonb_build_object(
         'linkedTournamentId',t.id,'tournamentStatus',t.status,'tournamentSport',t.sport,
         'tournamentEndDate',t.end_date,'tournamentMaxTeams',t.max_teams
       ),
       updated_at=now()
  from public.tournaments t
 where t.event_id=e.id;

-- Backfill Tournament winners into Event winners.
insert into public.event_winners(event_id,position,winner_name,staff_uid,remarks,source_tournament_winner_id)
select t.event_id,w.position,w.winner_name,w.staff_uid,w.remarks,w.id
from public.tournament_winners w
join public.tournaments t on t.id=w.tournament_id
on conflict(source_tournament_winner_id)
where source_tournament_winner_id is not null
do update set
  event_id=excluded.event_id,
  position=excluded.position,
  winner_name=excluded.winner_name,
  staff_uid=excluded.staff_uid,
  remarks=excluded.remarks;
