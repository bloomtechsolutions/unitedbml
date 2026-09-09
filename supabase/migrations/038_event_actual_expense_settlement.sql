-- UnitedBML: post-event actuals + finance settlement close.
-- events.actual_expense_total/actual_expense_remarks/actual_entered_by/actual_entered_at
-- and finance_settlement_status/finance_closed_at have existed in the schema since the
-- initial rebuild, but nothing ever wrote to them, so eventLifecycle() could never
-- actually reach "Closed" for a past event. These two RPCs are that missing writer.

-- Any active authenticated user may record the actual expense for a past event (matches
-- legacy behaviour: whoever ran the event enters what was actually spent, not just
-- Committee) — but only events RLS already lets Committee do everything via direct
-- update, so this RPC exists specifically to widen that one field to non-committee users
-- too, nothing else on the events row.
create or replace function public.record_event_actual_expense(
  p_event_id text, p_amount numeric, p_remarks text default null
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  e public.events;
begin
  if not public.is_active_authenticated_user() then raise exception 'Active UnitedBML login required'; end if;
  select * into e from public.events where id = p_event_id;
  if e.id is null then raise exception 'Event not found'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Enter a valid actual expense amount'; end if;

  update public.events
     set actual_expense_total = p_amount,
         actual_expense_remarks = p_remarks,
         actual_entered_by = auth.uid(),
         actual_entered_at = now(),
         finance_settlement_status = case
           when coalesce(finance_settlement_status,'Pending Actuals') = 'Closed' then finance_settlement_status
           else 'Actuals Recorded'
         end
   where id = p_event_id;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.record_event_actual_expense(text, numeric, text) to authenticated;

-- Closing the settlement (the step that lets eventLifecycle() reach "Closed") stays
-- Committee-only, and requires actuals to have been entered first.
create or replace function public.close_event_finance_settlement(p_event_id text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  e public.events;
begin
  if not public.is_committee_user() then raise exception 'Committee access required'; end if;
  select * into e from public.events where id = p_event_id;
  if e.id is null then raise exception 'Event not found'; end if;
  if e.actual_entered_at is null then raise exception 'Enter the actual expense before closing settlement'; end if;

  update public.events
     set finance_settlement_status = 'Closed',
         finance_closed_at = now()
   where id = p_event_id;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.close_event_finance_settlement(text) to authenticated;
