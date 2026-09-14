-- UnitedBML: enforce that a settlement's Direct Entry actual amount can never exceed its
-- approved amount (approved already includes any granted contingency top-up). The UI now
-- blocks this too, but the RPCs are the real guard since they're the only write path.
-- Overspend beyond what's approved must go through a Contingency Request first, which raises
-- the approved amount for that line — it is not something Treasurer entry or closing should
-- ever be able to paper over.

create or replace function public.save_settlement_actuals(
  p_settlement_key text,
  p_lines jsonb,
  p_remarks text default null
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_is_general boolean := p_settlement_key like 'REQ:%';
  v_request_id text := case when p_settlement_key like 'REQ:%' then substring(p_settlement_key from 5) else null end;
  v_total numeric(14,2) := 0;
  v_line jsonb;
  v_approved numeric(14,2);
  v_actual numeric(14,2);
begin
  if not public.is_active_authenticated_user() then raise exception 'Active UnitedBML login required'; end if;

  if v_is_general then
    if not exists (select 1 from public.expense_requests where id = v_request_id) then
      raise exception 'Expense request not found';
    end if;
  else
    if not exists (select 1 from public.events where id = p_settlement_key) then
      raise exception 'Event not found';
    end if;
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) loop
    if v_line->>'sourceType' = 'Direct Entry' then
      v_approved := coalesce((v_line->>'approvedAmount')::numeric,0);
      v_actual := coalesce((v_line->>'actualAmount')::numeric,0);
      if v_actual > v_approved + 0.01 then
        raise exception 'Actual amount for "%" (%) exceeds the approved amount (%). Request contingency first to raise the approved amount.',
          v_line->>'expenseItem', v_actual, v_approved;
      end if;
    end if;
  end loop;

  delete from public.event_actual_expenses where settlement_key = p_settlement_key;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) loop
    insert into public.event_actual_expenses(
      event_id, expense_request_id, expense_line_no, settlement_key, source_key, expense_item,
      approved_amount, actual_amount, variance_amount, source_type, manual_entered,
      vendor_name, reference, entered_by
    ) values (
      case when v_is_general then null else p_settlement_key end,
      nullif(v_line->>'expenseRequestId',''),
      nullif(v_line->>'lineIndex','')::int,
      p_settlement_key,
      v_line->>'sourceKey',
      v_line->>'expenseItem',
      coalesce((v_line->>'approvedAmount')::numeric,0),
      coalesce((v_line->>'actualAmount')::numeric,0),
      coalesce((v_line->>'approvedAmount')::numeric,0) - coalesce((v_line->>'actualAmount')::numeric,0),
      v_line->>'sourceType',
      coalesce((v_line->>'manualEntered')::boolean,false),
      nullif(v_line->>'vendorName',''),
      nullif(v_line->>'reference',''),
      auth.uid()
    );
    v_total := v_total + coalesce((v_line->>'actualAmount')::numeric,0);
  end loop;

  if v_is_general then
    update public.expense_requests set
      actual_expense_total = v_total,
      actual_expense_remarks = p_remarks,
      actual_entered_by = auth.uid(),
      actual_entered_at = now(),
      finance_settlement_status = case when coalesce(finance_settlement_status,'Pending Actuals') = 'Closed' then finance_settlement_status else 'Actuals Entered' end
    where id = v_request_id;
  else
    update public.events set
      actual_expense_total = v_total,
      actual_expense_remarks = p_remarks,
      actual_entered_by = auth.uid(),
      actual_entered_at = now(),
      finance_settlement_status = case when coalesce(finance_settlement_status,'Pending Actuals') = 'Closed' then finance_settlement_status else 'Actuals Entered' end
    where id = p_settlement_key;
  end if;

  return jsonb_build_object('ok', true, 'total', v_total);
end $$;
grant execute on function public.save_settlement_actuals(text, jsonb, text) to authenticated;

-- Defense in depth: close_settlement also refuses to close over an already-saved overspend
-- line, in case actuals were saved by an older client build before this cap existed.
create or replace function public.close_settlement(p_settlement_key text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_is_general boolean := p_settlement_key like 'REQ:%';
  v_request_id text := case when p_settlement_key like 'REQ:%' then substring(p_settlement_key from 5) else null end;
  v_entered_at timestamptz;
  v_pending int;
  v_overspent int;
begin
  if not public.is_committee_user() then raise exception 'Committee access required'; end if;

  if v_is_general then
    select actual_entered_at into v_entered_at from public.expense_requests where id = v_request_id;
  else
    select actual_entered_at into v_entered_at from public.events where id = p_settlement_key;
  end if;
  if v_entered_at is null then raise exception 'Enter the actual expenses before closing settlement'; end if;

  select count(*) into v_pending from public.contingency_requests
   where (case when v_is_general then expense_request_id = v_request_id else event_id = p_settlement_key end)
     and status in ('Pending President Recommendation','Pending Procurement Pre-Approval','Awaiting Procurement Response');
  if v_pending > 0 then
    raise exception 'Resolve pending contingency requests before closing this settlement';
  end if;

  select count(*) into v_overspent from public.event_actual_expenses
   where settlement_key = p_settlement_key
     and source_type = 'Direct Entry'
     and actual_amount > approved_amount + 0.01;
  if v_overspent > 0 then
    raise exception 'One or more expense lines exceed their approved amount. Correct the actuals or request contingency before closing.';
  end if;

  if v_is_general then
    update public.expense_requests set finance_settlement_status = 'Closed', finance_closed_at = now() where id = v_request_id;
  else
    update public.events set finance_settlement_status = 'Closed', finance_closed_at = now() where id = p_settlement_key;
  end if;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.close_settlement(text) to authenticated;
