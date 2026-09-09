-- UnitedBML: unified Finance Settlement Register + Contingency workflow activation.
--
-- Two things ship here:
-- 1. event_actual_expenses (created in 001, columns added in 004/007, but never written to)
--    becomes the shared per-line settlement table for BOTH Event-linked and General
--    (non-event) approved expenses, via a new settlement_key ('<event_id>' or
--    'REQ:<expense_request_id>' — mirrors the legacy build's dual-purpose entity key).
-- 2. expense_requests gets the same actual/settlement columns events already has, so a
--    General (event-less) approved expense request can carry its own settlement state.
--
-- The existing 038 RPCs (record_event_actual_expense/close_event_finance_settlement) are left
-- in place for backward compatibility with the Event workspace's quick aggregate-entry flow —
-- they keep writing the same events columns this migration's RPCs also write, so both stay
-- consistent. The status label 'Actuals Recorded' is normalized to 'Actuals Entered' to match
-- the legacy build's register/status vocabulary.

-- 1. General-scope settlement aggregate columns (mirrors events' equivalents).
alter table public.expense_requests
  add column if not exists actual_expense_total numeric(14,2) not null default 0,
  add column if not exists actual_expense_remarks text,
  add column if not exists actual_entered_by text,
  add column if not exists actual_entered_at timestamptz,
  add column if not exists finance_settlement_status text not null default 'Pending Actuals',
  add column if not exists finance_closed_at timestamptz;

-- 2. Normalize the status label across both entities, and stop 038's RPC from re-introducing
--    the old label on the next quick-entry save.
update public.events set finance_settlement_status = 'Actuals Entered' where finance_settlement_status = 'Actuals Recorded';

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
           else 'Actuals Entered'
         end
   where id = p_event_id;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.record_event_actual_expense(text, numeric, text) to authenticated;

-- 3. Activate event_actual_expenses for General-scope rows too.
alter table public.event_actual_expenses
  alter column event_id drop not null,
  add column if not exists settlement_key text;

update public.event_actual_expenses set settlement_key = event_id where settlement_key is null and event_id is not null;
update public.event_actual_expenses set settlement_key = 'REQ:' || expense_request_id
  where settlement_key is null and expense_request_id is not null;

alter table public.event_actual_expenses drop constraint if exists event_actual_expenses_event_id_source_key_key;
alter table public.event_actual_expenses drop constraint if exists event_actual_expenses_settlement_key_source_key_key;
alter table public.event_actual_expenses add constraint event_actual_expenses_settlement_key_source_key_key
  unique (settlement_key, source_key);

create index if not exists event_actual_expenses_settlement_key_idx on public.event_actual_expenses(settlement_key);

comment on table public.event_actual_expenses is
  'Per-line settlement actuals. settlement_key is either an event id (Event-linked) or REQ:<expense_request_id> (General).';

-- 4. Allow contingency requests against General (event-less) approved expenses too — the
--    guard trigger in 035 only keys off expense_request_id/line_index, never event_id.
alter table public.contingency_requests alter column event_id drop not null;

-- 5. save_settlement_actuals — replaces the whole per-line reconciliation for one settlement
--    in a single call (any active authenticated user, matching the legacy "any signed-in user
--    enters actuals" behaviour and the existing record_event_actual_expense RPC's access level).
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

-- 6. close_settlement — Committee-only, requires actuals already entered and no contingency
--    request for this settlement still active.
create or replace function public.close_settlement(p_settlement_key text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_is_general boolean := p_settlement_key like 'REQ:%';
  v_request_id text := case when p_settlement_key like 'REQ:%' then substring(p_settlement_key from 5) else null end;
  v_entered_at timestamptz;
  v_pending int;
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

  if v_is_general then
    update public.expense_requests set finance_settlement_status = 'Closed', finance_closed_at = now() where id = v_request_id;
  else
    update public.events set finance_settlement_status = 'Closed', finance_closed_at = now() where id = p_settlement_key;
  end if;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.close_settlement(text) to authenticated;
