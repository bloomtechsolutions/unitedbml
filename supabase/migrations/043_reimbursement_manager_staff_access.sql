-- UnitedBML: let the assigned Reimbursement Manager be ANY active account, not only a
-- committee member (e.g. a regular staff member managing reimbursement for an external
-- tournament). The manager identity moves to a plain auth user id (works for committee and
-- non-committee accounts alike); the committee-only columns added in 042 are superseded.
--
-- A non-committee "Staff Member" account otherwise has almost no read access to Finance data
-- (migration 023 locked expense_requests/expense_lines/reimbursement_cases/ap_batches/ap_bills
-- down to is_committee_user()). This migration adds narrow, additional read/write grants scoped
-- to "you are the assigned Reimbursement Manager of this specific event" — it does not loosen
-- anything for anyone else.

alter table public.events
  drop column if exists reimbursement_manager_committee_id,
  add column if not exists reimbursement_manager_user_id uuid references auth.users(id) on delete set null;

alter table public.ap_batches
  drop column if exists manager_committee_id,
  add column if not exists manager_user_id uuid references auth.users(id) on delete set null;

create or replace function public.is_event_reimbursement_manager(p_event_id text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.events e
    where e.id = p_event_id and e.reimbursement_manager_user_id = auth.uid()
  );
$$;
grant execute on function public.is_event_reimbursement_manager(text) to authenticated;

create or replace function public.is_reimbursement_manager_for_request(p_request_id text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.expense_requests r
    where r.id = p_request_id and public.is_event_reimbursement_manager(r.event_id)
  );
$$;
grant execute on function public.is_reimbursement_manager_for_request(text) to authenticated;

create or replace function public.is_reimbursement_manager_for_case(p_case_id text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.reimbursement_cases c
    where c.id = p_case_id and public.is_event_reimbursement_manager(c.event_id)
  );
$$;
grant execute on function public.is_reimbursement_manager_for_case(text) to authenticated;

-- Read access: only what the manager needs to see approved items for their own event and the
-- cases/batches built from them. Purely additive — existing committee policies are untouched.
drop policy if exists expense_requests_manager_read on public.expense_requests;
create policy expense_requests_manager_read on public.expense_requests for select to authenticated
using (public.is_event_reimbursement_manager(event_id));

drop policy if exists expense_lines_manager_read on public.expense_lines;
create policy expense_lines_manager_read on public.expense_lines for select to authenticated
using (public.is_reimbursement_manager_for_request(expense_request_id));

drop policy if exists reimbursement_case_manager_read on public.reimbursement_cases;
create policy reimbursement_case_manager_read on public.reimbursement_cases for select to authenticated
using (public.is_event_reimbursement_manager(event_id));

drop policy if exists ap_batches_manager_read on public.ap_batches;
create policy ap_batches_manager_read on public.ap_batches for select to authenticated
using (public.is_reimbursement_manager_for_case(reimbursement_id));

-- Write access: the manager may create a batch for their own event's case, and edit it only
-- while it is still their own pending submission — once reviewed (pending_review turns false)
-- this policy's USING clause stops matching and they lose write access to it entirely.
drop policy if exists ap_batches_manager_insert on public.ap_batches;
create policy ap_batches_manager_insert on public.ap_batches for insert to authenticated
with check (
  public.is_reimbursement_manager_for_case(reimbursement_id)
  and pending_review = true
  and submitted_by_manager = true
  and manager_user_id = auth.uid()
);

drop policy if exists ap_batches_manager_update on public.ap_batches;
create policy ap_batches_manager_update on public.ap_batches for update to authenticated
using (public.is_reimbursement_manager_for_case(reimbursement_id) and pending_review = true and manager_user_id = auth.uid())
with check (public.is_reimbursement_manager_for_case(reimbursement_id));

drop policy if exists ap_bills_manager_access on public.ap_bills;
create policy ap_bills_manager_access on public.ap_bills for all to authenticated
using (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
    and b.pending_review = true
    and b.manager_user_id = auth.uid()
))
with check (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
    and b.pending_review = true
    and b.manager_user_id = auth.uid()
));
