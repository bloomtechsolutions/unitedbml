-- UnitedBML full module audit patch. Non-destructive and safe for existing operational data.

-- Ensure role helper functions exist on projects upgraded from older builds.
create or replace function public.current_role() returns text
language sql stable security definer set search_path=public as $$
  select coalesce((select role from public.profiles where id=auth.uid()),'Staff Member')
$$;
create or replace function public.is_committee_user() returns boolean
language sql stable security definer set search_path=public as $$
  select lower(coalesce(public.current_role(),'Staff Member')) <> 'staff member'
$$;

-- Email workflow columns required by the current Edge Function and UI.
alter table public.email_log add column if not exists provider text not null default 'Gmail';
alter table public.email_log add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.email_log add column if not exists provider_message_id text;
alter table public.email_log add column if not exists error_message text;

alter table public.reimbursement_cases add column if not exists email_sent_at timestamptz;
alter table public.reimbursement_cases add column if not exists email_provider text;
alter table public.reimbursement_cases add column if not exists email_provider_message_id text;

alter table public.ap_batches add column if not exists bills_attachment_path text;
alter table public.ap_bills add column if not exists worker_id text;

alter table public.event_actual_expenses add column if not exists source_type text;
alter table public.event_actual_expenses add column if not exists expense_request_id text;
alter table public.event_actual_expenses add column if not exists expense_line_no int;
alter table public.event_actual_expenses add column if not exists reimbursement_reference text;
alter table public.event_actual_expenses add column if not exists ap_status text;
alter table public.event_actual_expenses add column if not exists is_reimbursement boolean not null default false;
alter table public.event_actual_expenses add column if not exists manual_entered boolean not null default false;

-- Ensure authenticated committee users can read/write the workflow log tables even on projects upgraded from older builds.
alter table public.email_log enable row level security;
drop policy if exists committee_read on public.email_log;
drop policy if exists committee_write on public.email_log;
create policy committee_read on public.email_log for select to authenticated using (public.is_committee_user());
create policy committee_write on public.email_log for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user());
