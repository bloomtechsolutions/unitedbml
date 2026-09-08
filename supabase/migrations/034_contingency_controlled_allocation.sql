
-- UnitedBML V12.10.7
-- Controlled contingency allocation workflow.

create table if not exists public.contingency_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  event_id text not null,
  event_name text,
  expense_request_id text not null,
  expense_request_number text,
  line_index integer not null,
  expense_item text not null,
  original_approved_amount numeric(18,2) not null default 0,
  contingency_available_at_request numeric(18,2) not null default 0,
  requested_amount numeric(18,2) not null default 0,
  reason text not null,
  status text not null default 'Pending President Recommendation',
  requested_by uuid references auth.users(id) on delete set null,
  requested_by_name text,
  requested_by_role text,
  requested_by_email text,
  requested_at timestamptz not null default now(),
  president_recommendation text,
  president_by text,
  president_at timestamptz,
  procurement_to text,
  procurement_subject text,
  procurement_email_sent_at timestamptz,
  procurement_decision text,
  procurement_response_date date,
  procurement_response_by text,
  procurement_response_attachment_path text,
  procurement_response_attachment_name text,
  procurement_response_attachment_type text,
  procurement_response_attachment_size bigint not null default 0,
  released_amount numeric(18,2) not null default 0,
  released_at timestamptz,
  released_by text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contingency_requests_event_idx on public.contingency_requests(event_id);
create index if not exists contingency_requests_expense_line_idx on public.contingency_requests(expense_request_id,line_index);
create index if not exists contingency_requests_status_idx on public.contingency_requests(status);

alter table public.contingency_requests enable row level security;

drop policy if exists contingency_requests_read on public.contingency_requests;
drop policy if exists contingency_requests_write on public.contingency_requests;

create policy contingency_requests_read on public.contingency_requests
for select to authenticated using(public.is_committee_user());

create policy contingency_requests_write on public.contingency_requests
for all to authenticated using(public.is_committee_user()) with check(public.is_committee_user());
