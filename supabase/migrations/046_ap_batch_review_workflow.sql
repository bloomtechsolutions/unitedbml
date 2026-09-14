-- UnitedBML: turn "Approve for AP" from a single silent click into a real review decision —
-- Approve & Send (triggers the existing AP email) or Return to Manager with a reason, so a
-- Reimbursement Manager's submission always gets an explicit outcome instead of disappearing.

alter table public.ap_batches
  add column if not exists return_reason text,
  add column if not exists returned_by text,
  add column if not exists returned_at timestamptz;

-- Approving now also clears any earlier return, so a resubmission that gets approved doesn't
-- still show stale "returned" state.
create or replace function public.review_ap_batch(p_batch_id text, p_reviewer_name text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_committee_user() then raise exception 'Committee access required'; end if;

  update public.ap_batches
     set pending_review = false,
         reviewed_by = p_reviewer_name,
         reviewed_at = now(),
         return_reason = null,
         returned_by = null,
         returned_at = null
   where id = p_batch_id and status = 'Draft';

  if not found then
    raise exception 'Batch not found or no longer in Draft.';
  end if;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.review_ap_batch(text, text) to authenticated;

-- return_ap_batch_to_manager — committee-only, sends a pending submission back to the assigned
-- Manager with a required reason. Keeps pending_review = true so it's still their to edit (the
-- ap_batches_manager_update policy from 043 already permits that), just flags why.
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
     set pending_review = true,
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
