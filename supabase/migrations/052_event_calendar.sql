-- UnitedBML: Event Calendar — lightweight planned-activity placeholders (before a real
-- Event exists) and a committee-editable Maldives public holiday list.

create table public.event_planned_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  planned_date date not null,
  event_type text,
  notes text,
  promoted_event_id text references public.events(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_planned_activities_date_idx on public.event_planned_activities(planned_date);

alter table public.event_planned_activities enable row level security;

drop policy if exists event_planned_activities_read on public.event_planned_activities;
drop policy if exists event_planned_activities_write on public.event_planned_activities;
create policy event_planned_activities_read on public.event_planned_activities
for select to authenticated using (public.is_committee_user());
create policy event_planned_activities_write on public.event_planned_activities
for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user());

create table public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  type text not null default 'Public' check (type in ('Public', 'Observance')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (holiday_date, name)
);

create index public_holidays_date_idx on public.public_holidays(holiday_date);

alter table public.public_holidays enable row level security;

drop policy if exists public_holidays_read on public.public_holidays;
drop policy if exists public_holidays_write on public.public_holidays;
create policy public_holidays_read on public.public_holidays
for select to authenticated using (public.is_committee_user());
create policy public_holidays_write on public.public_holidays
for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user());

-- Seed 2026 Maldives public holidays. Fixed-Gregorian-date holidays are reliable; Islamic-calendar
-- holidays (Eid al-Fitr, Hajj Day, Eid al-Adha, National Day, Mawlid) are moon-sighting dependent —
-- the dates below are the best available forecast as of this migration and should be confirmed
-- (and corrected here if needed) once officially announced.
insert into public.public_holidays (holiday_date, name, type, notes) values
  ('2026-01-01', 'New Year''s Day', 'Public', null),
  ('2026-03-20', 'Eid al-Fitr', 'Public', 'Forecast date — subject to moon sighting'),
  ('2026-03-21', 'Eid al-Fitr Holiday', 'Public', 'Forecast date — subject to moon sighting'),
  ('2026-03-22', 'Eid al-Fitr Holiday', 'Public', 'Forecast date — subject to moon sighting'),
  ('2026-05-26', 'Hajj Day', 'Public', 'Forecast date — subject to moon sighting'),
  ('2026-05-27', 'Eid al-Adha', 'Public', 'Forecast date — subject to moon sighting'),
  ('2026-05-28', 'Eid al-Adha Holiday', 'Public', 'Forecast date — subject to moon sighting'),
  ('2026-05-29', 'Eid al-Adha Holiday', 'Public', 'Forecast date — subject to moon sighting'),
  ('2026-07-26', 'Independence Day', 'Public', null),
  ('2026-07-27', 'Independence Day Holiday', 'Public', null),
  ('2026-08-14', 'National Day', 'Public', 'Forecast date — Islamic calendar, subject to confirmation'),
  ('2026-08-25', 'Mawlid al-Nabi (Prophet''s Birthday)', 'Observance', 'Forecast date — subject to moon sighting'),
  ('2026-11-03', 'Victory Day', 'Public', null),
  ('2026-11-11', 'Republic Day', 'Public', null)
on conflict (holiday_date, name) do nothing;
