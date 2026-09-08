\
-- UnitedBML V12.10.9
-- Add traceability for President contingency notifications.

alter table public.contingency_requests
  add column if not exists president_notification_to text,
  add column if not exists president_notification_subject text,
  add column if not exists president_notification_sent_at timestamptz,
  add column if not exists president_notification_status text,
  add column if not exists president_notification_error text;

create index if not exists contingency_requests_president_queue_idx
  on public.contingency_requests(status, requested_at desc);

comment on column public.contingency_requests.president_notification_status is
'Tracks whether the President notification email was Sent, Failed, or Not Available.';
