-- UnitedBML: per-event "Reimbursement Manager" assignment, and a committee-review gate on the
-- AP batches that manager submits for their own event.
--
-- Scenario: staff participate in an external event (e.g. a futsal tournament run by someone
-- else) and a committee member is assigned to manage reimbursement for it. That manager can
-- build and submit the AP batch (bills) for their assigned event's approved expenses, but
-- cannot send it to Accounts Payable themselves — any other committee member must review it
-- first. Everyone else's existing, unrestricted ability to create and send AP batches directly
-- (for any event) is untouched; this only adds a stricter path for the assigned Manager persona.

alter table public.events
  add column if not exists reimbursement_manager text,
  add column if not exists reimbursement_manager_role text,
  add column if not exists reimbursement_manager_committee_id text references public.committee_members(id);

alter table public.ap_batches
  add column if not exists submitted_by_manager boolean not null default false,
  add column if not exists manager_committee_id text references public.committee_members(id),
  add column if not exists manager_submitted_by text,
  add column if not exists manager_submitted_at timestamptz,
  add column if not exists pending_review boolean not null default false,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;

-- Server-side guard: a batch still awaiting review can never transition to 'Sent to AP', no
-- matter what the client sends — this is the real enforcement, not just a hidden button.
create or replace function public.enforce_ap_batch_review_gate()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Sent to AP' and coalesce(old.pending_review, false) then
    raise exception 'This AP batch is awaiting committee review before it can be sent to Accounts Payable.';
  end if;
  return new;
end $$;

drop trigger if exists trg_ap_batch_review_gate on public.ap_batches;
create trigger trg_ap_batch_review_gate
before update on public.ap_batches
for each row execute function public.enforce_ap_batch_review_gate();

-- review_ap_batch — any committee user can clear the review gate on a manager-submitted batch,
-- unblocking the normal Send-to-AP step. Does not send anything itself.
create or replace function public.review_ap_batch(p_batch_id text, p_reviewer_name text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_committee_user() then raise exception 'Committee access required'; end if;

  update public.ap_batches
     set pending_review = false,
         reviewed_by = p_reviewer_name,
         reviewed_at = now()
   where id = p_batch_id and status = 'Draft';

  if not found then
    raise exception 'Batch not found or no longer in Draft.';
  end if;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.review_ap_batch(text, text) to authenticated;
