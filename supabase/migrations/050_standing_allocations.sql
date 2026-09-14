-- UnitedBML: Standing Allocations module.
-- Tracks pre-approved activities run outside UnitedBML (e.g. Fun with Team,
-- UBML Allowance, Women's Day, Men's Day, Year End Activities) whose spend
-- is still deducted from the UBML account and reported monthly by Finance.

create table public.standing_allocations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cadence text not null default 'Monthly' check (cadence in ('Monthly', 'Annual')),
  budget_year int not null default extract(year from now())::int,
  allocated_amount numeric(14,2) not null default 0,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, budget_year)
);

create table public.standing_allocation_entries (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.standing_allocations(id) on delete cascade,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  actual_amount numeric(14,2) not null default 0,
  description text,
  source_reference text,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_by_name text,
  created_at timestamptz not null default now()
);

create index standing_allocation_entries_allocation_idx on public.standing_allocation_entries(allocation_id);
create index standing_allocation_entries_period_idx on public.standing_allocation_entries(period_year, period_month);

alter table public.standing_allocations enable row level security;
alter table public.standing_allocation_entries enable row level security;

drop policy if exists standing_allocations_read on public.standing_allocations;
drop policy if exists standing_allocations_write on public.standing_allocations;
create policy standing_allocations_read on public.standing_allocations
for select to authenticated using (public.is_committee_user());
create policy standing_allocations_write on public.standing_allocations
for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user());

drop policy if exists standing_allocation_entries_read on public.standing_allocation_entries;
drop policy if exists standing_allocation_entries_write on public.standing_allocation_entries;
create policy standing_allocation_entries_read on public.standing_allocation_entries
for select to authenticated using (public.is_committee_user());
create policy standing_allocation_entries_write on public.standing_allocation_entries
for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user());

insert into public.standing_allocations (name, cadence, budget_year, allocated_amount)
values
  ('Fun with Team', 'Monthly', extract(year from now())::int, 0),
  ('UBML Allowance', 'Monthly', extract(year from now())::int, 0),
  ('Women''s Day', 'Annual', extract(year from now())::int, 0),
  ('Men''s Day', 'Annual', extract(year from now())::int, 0),
  ('Year End Activities', 'Annual', extract(year from now())::int, 0)
on conflict (name, budget_year) do nothing;
