-- UnitedBML secure no-login final expense approval
-- Non-destructive.

alter table public.expense_requests
  add column if not exists final_approval_token_expires_at timestamptz,
  add column if not exists final_approval_token_used_at timestamptz;

create index if not exists expense_requests_final_approval_token_idx
  on public.expense_requests(final_approval_token)
  where final_approval_token is not null;

-- Tokens are never exposed through an anonymous table policy.
-- Public access is only through the expense-approval Edge Function,
-- which validates the one-time token using the service role.
