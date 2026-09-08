-- UnitedBML secure no-login President recommendation stage
alter table public.expense_requests
  add column if not exists president_email text,
  add column if not exists president_approval_token text,
  add column if not exists president_approval_token_expires_at timestamptz,
  add column if not exists president_approval_token_used_at timestamptz,
  add column if not exists president_approval_email_sent_at timestamptz,
  add column if not exists president_approval_email_status text,
  add column if not exists president_approval_email_error text,
  add column if not exists president_approval_email_message_id text;

create index if not exists expense_requests_president_approval_token_idx
  on public.expense_requests(president_approval_token)
  where president_approval_token is not null;
