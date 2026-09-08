-- UnitedBML server-issued President approval links
-- Non-destructive schema assurance. Existing broken pending President tokens
-- are cleared so the next automatic/retry email gets one authoritative token.

alter table public.expense_requests
  add column if not exists president_email text,
  add column if not exists president_approval_token text,
  add column if not exists president_approval_token_expires_at timestamptz,
  add column if not exists president_approval_token_used_at timestamptz,
  add column if not exists president_approval_email_sent_at timestamptz,
  add column if not exists president_approval_email_status text,
  add column if not exists president_approval_email_error text,
  add column if not exists president_approval_email_message_id text;

update public.expense_requests
set
  president_approval_token = null,
  president_approval_token_expires_at = null,
  president_approval_token_used_at = null,
  president_approval_email_status = 'Needs Resend',
  president_approval_email_error = 'Previous browser-issued secure link invalidated. Resend using server-issued workflow.',
  data = jsonb_set(
    jsonb_set(
      jsonb_set(coalesce(data,'{}'::jsonb), '{presidentApprovalToken}', '""'::jsonb, true),
      '{presidentApprovalTokenExpiresAt}', '""'::jsonb, true
    ),
    '{presidentApprovalEmailStatus}', '"Needs Resend"'::jsonb, true
  )
where status='Pending President Recommendation';

create index if not exists expense_requests_president_approval_token_idx
  on public.expense_requests(president_approval_token)
  where president_approval_token is not null;
