-- UnitedBML: automatic final approval email tracking
-- Non-destructive. Run on an existing project before deploying this build.

alter table public.expense_requests
  add column if not exists final_approval_email_status text,
  add column if not exists final_approval_email_attempted_at timestamptz,
  add column if not exists final_approval_email_error text,
  add column if not exists final_approval_email_automatic boolean not null default false;

create index if not exists idx_expense_final_email_status
  on public.expense_requests(final_approval_email_status);
