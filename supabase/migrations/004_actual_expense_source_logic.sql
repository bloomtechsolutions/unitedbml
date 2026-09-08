-- ClubSphere post-event actual expense source tracking
-- Non-destructive migration. Existing actual-expense records remain intact.

alter table public.event_actual_expenses
  add column if not exists source_type text,
  add column if not exists expense_request_id text,
  add column if not exists expense_line_no integer,
  add column if not exists reimbursement_reference text,
  add column if not exists ap_status text,
  add column if not exists is_reimbursement boolean not null default false,
  add column if not exists manual_entered boolean not null default false;

create index if not exists event_actual_expenses_request_line_idx
  on public.event_actual_expenses(expense_request_id, expense_line_no);

create index if not exists event_actual_expenses_source_type_idx
  on public.event_actual_expenses(source_type);
