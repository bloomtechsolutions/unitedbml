-- UnitedBML: let the assigned Reimbursement Manager keep reading their own submitted bills
-- after committee review (needed to "track status"), while write access stays gated to their
-- own pending (not-yet-reviewed) submission, exactly as before.

drop policy if exists ap_bills_manager_access on public.ap_bills;

create policy ap_bills_manager_read on public.ap_bills for select to authenticated
using (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
));

create policy ap_bills_manager_insert on public.ap_bills for insert to authenticated
with check (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
    and b.pending_review = true
    and b.manager_user_id = auth.uid()
));

create policy ap_bills_manager_update on public.ap_bills for update to authenticated
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

create policy ap_bills_manager_delete on public.ap_bills for delete to authenticated
using (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
    and b.pending_review = true
    and b.manager_user_id = auth.uid()
));
