-- UnitedBML V12.8.1
-- Repair for V12.8 external reimbursement history RLS policy typo.
-- Safe to run after a partially successful V12.8 migration.

alter table public.external_reimbursement_history enable row level security;

drop policy if exists external_reimb_hist_read on public.external_reimbursement_history;
drop policy if exists external_reimb_hist_write on public.external_reimbursement_history;

create policy external_reimb_hist_read
on public.external_reimbursement_history
for select
to authenticated
using (
  public.is_committee_user()
  or exists (
    select 1
    from public.external_event_reimbursements x
    where x.id = external_reimbursement_id
      and x.official_user_id = auth.uid()
  )
);

create policy external_reimb_hist_write
on public.external_reimbursement_history
for insert
to authenticated
with check (
  public.is_committee_user()
  or actor_id = auth.uid()
);
