-- UnitedBML secure final approval email pipeline repair
-- Non-destructive and safe on existing data.

alter table public.expense_requests
  add column if not exists final_approval_token_expires_at timestamptz,
  add column if not exists final_approval_token_used_at timestamptz,
  add column if not exists final_approval_email_status text,
  add column if not exists final_approval_email_attempted_at timestamptz,
  add column if not exists final_approval_email_error text,
  add column if not exists final_approval_email_automatic boolean not null default false;

create index if not exists expense_requests_final_approval_token_idx
  on public.expense_requests(final_approval_token)
  where final_approval_token is not null;
