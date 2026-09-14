-- UnitedBML: fix the Return-to-Manager flow. Returning a submission was leaving
-- pending_review = true, which is the exact same flag the committee's "Pending Review" list and
-- Review button key off — so a batch that had just been returned to the Manager (and therefore
-- was no longer awaiting a committee decision) kept showing up as if it still needed review.
--
-- pending_review now means, specifically, "awaiting a committee decision". Returning sets it
-- false (nothing left for committee to do until the Manager fixes it) while return_reason stays
-- set to flag the Manager's own queue; resubmitting flips pending_review back to true and clears
-- the return fields (see the TS side of this change in saveApBatchDraft).

create or replace function public.return_ap_batch_to_manager(p_batch_id text, p_reviewer_name text, p_reason text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_committee_user() then raise exception 'Committee access required'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required when returning a submission to the Manager.';
  end if;

  update public.ap_batches
     set pending_review = false,
         return_reason = p_reason,
         returned_by = p_reviewer_name,
         returned_at = now()
   where id = p_batch_id and status = 'Draft';

  if not found then
    raise exception 'Batch not found or no longer in Draft.';
  end if;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.return_ap_batch_to_manager(text, text, text) to authenticated;

-- The Manager can still write to a batch while it's either freshly submitted (pending_review)
-- or has been returned to them (return_reason set) — not only while pending_review is true.
drop policy if exists ap_batches_manager_update on public.ap_batches;
create policy ap_batches_manager_update on public.ap_batches for update to authenticated
using (
  public.is_reimbursement_manager_for_case(reimbursement_id)
  and manager_user_id = auth.uid()
  and (pending_review = true or return_reason is not null)
)
with check (public.is_reimbursement_manager_for_case(reimbursement_id));

drop policy if exists ap_bills_manager_read on public.ap_bills;
create policy ap_bills_manager_read on public.ap_bills for select to authenticated
using (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
));

drop policy if exists ap_bills_manager_insert on public.ap_bills;
create policy ap_bills_manager_insert on public.ap_bills for insert to authenticated
with check (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
    and b.manager_user_id = auth.uid()
    and (b.pending_review = true or b.return_reason is not null)
));

drop policy if exists ap_bills_manager_update on public.ap_bills;
create policy ap_bills_manager_update on public.ap_bills for update to authenticated
using (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
    and b.manager_user_id = auth.uid()
    and (b.pending_review = true or b.return_reason is not null)
))
with check (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
    and b.manager_user_id = auth.uid()
    and (b.pending_review = true or b.return_reason is not null)
));

drop policy if exists ap_bills_manager_delete on public.ap_bills;
create policy ap_bills_manager_delete on public.ap_bills for delete to authenticated
using (exists(
  select 1 from public.ap_batches b
  where b.id = ap_bills.ap_batch_id
    and public.is_reimbursement_manager_for_case(b.reimbursement_id)
    and b.manager_user_id = auth.uid()
    and (b.pending_review = true or b.return_reason is not null)
));

-- Belt and suspenders: no matter what pending_review/return_reason say, a non-committee account
-- can never flip a batch to 'Sent to AP' — only the review flow (committee) can.
create or replace function public.enforce_ap_batch_review_gate()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Sent to AP' and old.status <> 'Sent to AP' then
    if coalesce(old.pending_review, false) then
      raise exception 'This AP batch is awaiting committee review before it can be sent to Accounts Payable.';
    end if;
    if not public.is_committee_user() then
      raise exception 'Only a committee member can send a batch to Accounts Payable.';
    end if;
  end if;
  return new;
end $$;
