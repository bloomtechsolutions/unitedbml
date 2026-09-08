-- UnitedBML focused V12 Tournament V12.3 compatibility hotfix
-- Fixes:
-- null value in column "player_name" of relation "tournament_registrations"
-- violates not-null constraint

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
