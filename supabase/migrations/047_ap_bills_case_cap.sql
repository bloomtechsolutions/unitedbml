-- UnitedBML: server-side guard so the bills across every non-cancelled AP batch for one
-- reimbursement case can never add up to more than that case's approved amount — a case can
-- legitimately be submitted more than once (e.g. a first partial batch already Paid, then a
-- second for the remaining balance), so this sums across ALL of them rather than assuming one.
-- The client (ApBatchModal) already blocks this via apCommittedTotal; this is the real
-- enforcement regardless of what any client sends.

create or replace function public.enforce_ap_bills_case_cap()
returns trigger
language plpgsql
as $$
declare
  v_case_id text;
  v_approved numeric(14,2);
  v_total numeric(14,2);
begin
  select reimbursement_id into v_case_id from public.ap_batches where id = new.ap_batch_id;
  if v_case_id is null then return new; end if;

  select approved_item_amount into v_approved from public.reimbursement_cases where id = v_case_id;
  if v_approved is null then return new; end if;

  select coalesce(sum(bill.amount), 0) into v_total
    from public.ap_bills bill
    join public.ap_batches b on b.id = bill.ap_batch_id
   where b.reimbursement_id = v_case_id
     and b.status <> 'Cancelled';

  if v_total > v_approved + 0.01 then
    raise exception 'Total bills for this case (%) would exceed the approved amount (%).', v_total, v_approved;
  end if;

  return new;
end $$;

drop trigger if exists trg_ap_bills_case_cap on public.ap_bills;
create trigger trg_ap_bills_case_cap
after insert or update on public.ap_bills
for each row execute function public.enforce_ap_bills_case_cap();
