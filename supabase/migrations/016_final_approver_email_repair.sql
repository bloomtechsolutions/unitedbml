-- UnitedBML final approver email repair
-- Backfills blank final_approver_email from active Committee member records.

update public.expense_requests r
set
  final_approver_email = c.email,
  data = jsonb_set(
    coalesce(r.data,'{}'::jsonb),
    '{finalApproverEmail}',
    to_jsonb(c.email),
    true
  ),
  updated_at = now()
from public.committee_members c
where coalesce(trim(r.final_approver_email),'') = ''
  and coalesce(trim(c.email),'') <> ''
  and lower(trim(c.status)) = 'active'
  and lower(trim(c.name)) = lower(trim(r.final_approver_name))
  and lower(replace(replace(trim(c.role),'_',' '),'-',' ')) =
      lower(replace(replace(trim(r.final_approver_role),'_',' '),'-',' '));

-- Fallback by exact selected name if role text differs slightly.
update public.expense_requests r
set
  final_approver_email = c.email,
  data = jsonb_set(
    coalesce(r.data,'{}'::jsonb),
    '{finalApproverEmail}',
    to_jsonb(c.email),
    true
  ),
  updated_at = now()
from public.committee_members c
where coalesce(trim(r.final_approver_email),'') = ''
  and coalesce(trim(c.email),'') <> ''
  and lower(trim(c.status)) = 'active'
  and lower(trim(c.name)) = lower(trim(r.final_approver_name));
