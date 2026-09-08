-- UnitedBML expense line recovery and protection support
-- Non-destructive. Restores missing child rows from expense_requests.data->lines
-- where a compatibility snapshot still contains the original line items.

insert into public.expense_lines (
  expense_request_id,
  line_no,
  description,
  quantity,
  rate,
  line_total,
  vendor_number,
  vendor,
  reimbursement_required,
  data
)
select
  r.id,
  x.ord::int,
  coalesce(nullif(x.item->>'description',''), 'Expense Item'),
  coalesce(
    nullif(x.item->>'qty','')::numeric,
    nullif(x.item->>'quantity','')::numeric,
    1
  ),
  coalesce(nullif(x.item->>'rate','')::numeric,0),
  coalesce(
    nullif(x.item->>'total','')::numeric,
    nullif(x.item->>'lineTotal','')::numeric,
    coalesce(nullif(x.item->>'qty','')::numeric,nullif(x.item->>'quantity','')::numeric,1)
      * coalesce(nullif(x.item->>'rate','')::numeric,0)
  ),
  nullif(x.item->>'vendorNumber',''),
  coalesce(nullif(x.item->>'vendor',''),nullif(x.item->>'vendorName','')),
  case lower(coalesce(x.item->>'reimbursementRequired','false'))
    when 'true' then true else false end,
  x.item
from public.expense_requests r
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(r.data->'lines')='array' then r.data->'lines'
    else '[]'::jsonb
  end
) with ordinality as x(item,ord)
where not exists (
  select 1 from public.expense_lines l
  where l.expense_request_id=r.id
)
on conflict (expense_request_id,line_no) do nothing;
