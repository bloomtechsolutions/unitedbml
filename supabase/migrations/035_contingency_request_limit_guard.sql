\
-- UnitedBML V12.10.8
-- Hard database guard: contingency requests cannot exceed the approved reserve.
-- Pending requests reserve their requested amount until rejected/cancelled.

alter table public.contingency_requests
  drop constraint if exists contingency_requests_positive_requested_amount;

alter table public.contingency_requests
  add constraint contingency_requests_positive_requested_amount
  check (requested_amount > 0);

create or replace function public.guard_contingency_request_limit()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_reserve numeric(18,2);
  v_committed numeric(18,2);
  v_new_commitment numeric(18,2);
  v_active boolean;
begin
  select coalesce(er.contingency_amount,0)
    into v_reserve
    from public.expense_requests er
   where er.id = new.expense_request_id
   for update;

  if not found then
    raise exception 'Expense Request % does not exist', new.expense_request_id;
  end if;

  -- Do not trust the value supplied by the browser.
  select greatest(
    0,
    v_reserve - coalesce(sum(
      case
        when cr.status = 'Approved' then coalesce(cr.released_amount,0)
        when cr.status in (
          'Pending President Recommendation',
          'Pending Procurement Pre-Approval',
          'Awaiting Procurement Response'
        ) then coalesce(cr.requested_amount,0)
        else 0
      end
    ),0)
  )
  into new.contingency_available_at_request
  from public.contingency_requests cr
  where cr.expense_request_id = new.expense_request_id
    and cr.id is distinct from new.id;

  v_active := new.status in (
    'Pending President Recommendation',
    'Pending Procurement Pre-Approval',
    'Awaiting Procurement Response',
    'Approved'
  );

  v_new_commitment :=
    case
      when new.status = 'Approved'
        then greatest(coalesce(new.released_amount,0),coalesce(new.requested_amount,0))
      when v_active
        then coalesce(new.requested_amount,0)
      else 0
    end;

  select coalesce(sum(
    case
      when cr.status = 'Approved' then coalesce(cr.released_amount,0)
      when cr.status in (
        'Pending President Recommendation',
        'Pending Procurement Pre-Approval',
        'Awaiting Procurement Response'
      ) then coalesce(cr.requested_amount,0)
      else 0
    end
  ),0)
  into v_committed
  from public.contingency_requests cr
  where cr.expense_request_id = new.expense_request_id
    and cr.id is distinct from new.id;

  if v_new_commitment > greatest(0,v_reserve-v_committed) + 0.001 then
    raise exception
      'Contingency limit exceeded. Available: MVR %, requested/committed: MVR %',
      round(greatest(0,v_reserve-v_committed),2),
      round(v_new_commitment,2);
  end if;

  if coalesce(new.released_amount,0) > coalesce(new.requested_amount,0) + 0.001 then
    raise exception 'Released contingency cannot exceed the approved requested amount';
  end if;

  return new;
end
$$;

drop trigger if exists trg_guard_contingency_request_limit
  on public.contingency_requests;

create trigger trg_guard_contingency_request_limit
before insert or update of
  expense_request_id,
  requested_amount,
  status,
  released_amount
on public.contingency_requests
for each row
execute function public.guard_contingency_request_limit();

comment on function public.guard_contingency_request_limit() is
'Prevents active contingency requests and released allocations from exceeding expense_requests.contingency_amount. Pending requests reserve contingency.';
