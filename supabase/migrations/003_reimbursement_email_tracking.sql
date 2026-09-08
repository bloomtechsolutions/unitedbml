-- ClubSphere reimbursement email tracking
alter table public.reimbursement_cases add column if not exists email_sent_at timestamptz, add column if not exists email_provider text, add column if not exists email_provider_message_id text;
alter table public.email_log add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists reimbursement_cases_email_provider_message_id_idx on public.reimbursement_cases(email_provider_message_id);
