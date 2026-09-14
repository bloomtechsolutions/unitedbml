-- UnitedBML: raise an in-app notification for committee members when a Reimbursement Manager
-- submits (or resubmits) bills for review — nothing currently tells anyone there's something
-- waiting in AP Submissions. Also notify the Manager back when their submission is returned,
-- closing the loop the same way.

create or replace function public.notify_committee_on_ap_batch_review()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare
  v_case public.reimbursement_cases;
  v_title text;
begin
  -- Fire only on the transition into "awaiting committee review" — a fresh submission (INSERT)
  -- or a resubmission after being returned (UPDATE where it wasn't already pending).
  if new.pending_review and (tg_op = 'INSERT' or not coalesce(old.pending_review, false)) then
    select * into v_case from public.reimbursement_cases where id = new.reimbursement_id;
    v_title := coalesce(v_case.event_name, 'General Expense') || ' · ' || coalesce(v_case.expense_item, new.submission_ref);

    insert into public.notifications(user_id, title, message, related_type, related_id)
    select pr.id,
           'Reimbursement submission for review',
           v_title || coalesce(' · submitted by ' || new.manager_submitted_by, ''),
           'ap_batch',
           new.id
    from public.profiles pr
    where lower(coalesce(pr.status, 'Active')) <> 'inactive'
      and lower(coalesce(pr.role, '')) in (
        'administrator', 'chairperson', 'vice chairperson', 'vice_chairperson', 'president',
        'treasurer', 'secretary', 'communications coordinator',
        'male coordinator 1', 'male coordinator 2', 'atoll coordinator', 'atoll representative',
        'head of total rewards & employee relations',
        'head of talent acquisition & people development',
        'head of employee experience & hr business partnering'
      );
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_committee_on_ap_batch_review on public.ap_batches;
create trigger trg_notify_committee_on_ap_batch_review
after insert or update of pending_review on public.ap_batches
for each row execute function public.notify_committee_on_ap_batch_review();

-- Tell the Manager when their submission is sent back, so they don't have to stumble onto it.
create or replace function public.return_ap_batch_to_manager(p_batch_id text, p_reviewer_name text, p_reason text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_batch public.ap_batches;
  v_case public.reimbursement_cases;
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
   where id = p_batch_id and status = 'Draft'
  returning * into v_batch;

  if v_batch.id is null then
    raise exception 'Batch not found or no longer in Draft.';
  end if;

  if v_batch.manager_user_id is not null then
    select * into v_case from public.reimbursement_cases where id = v_batch.reimbursement_id;
    insert into public.notifications(user_id, title, message, related_type, related_id)
    values (
      v_batch.manager_user_id,
      'Submission returned — changes needed',
      coalesce(v_case.event_name, 'General Expense') || ' · ' || coalesce(v_case.expense_item, v_batch.submission_ref) || ': ' || p_reason,
      'ap_batch',
      v_batch.id
    );
  end if;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.return_ap_batch_to_manager(text, text, text) to authenticated;
