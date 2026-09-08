-- ClubSphere normalized Supabase schema v2
-- IMPORTANT: This rebuild intentionally clears old ClubSphere operational/demo data.
-- Supabase Auth users are preserved. Existing profile rows are preserved.

create extension if not exists pgcrypto;

-- AUTH PROFILE (preserve user identities/roles if already configured)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null default '',
  role text not null default 'Staff Member',
  committee_slot text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists committee_slot text;
alter table public.profiles add column if not exists status text not null default 'Active';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict(id) do update set email=excluded.email;
  return new;
end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute procedure public.handle_new_user();

insert into public.profiles(id,email,full_name)
select id,email,coalesce(raw_user_meta_data->>'full_name','') from auth.users
on conflict(id) do nothing;

create or replace function public.current_role() returns text
language sql stable security definer set search_path=public as $$
  select coalesce((select role from public.profiles where id=auth.uid()),'Staff Member')
$$;
create or replace function public.is_committee_user() returns boolean
language sql stable security definer set search_path=public as $$
  select public.current_role() <> 'Staff Member'
$$;

-- Remove old operational schema so stale dummy data and incompatible columns cannot survive.
drop table if exists public.notifications cascade;
drop table if exists public.audit_log cascade;
drop table if exists public.email_log cascade;
drop table if exists public.attachments cascade;
drop table if exists public.ap_bills cascade;
drop table if exists public.ap_batches cascade;
drop table if exists public.reimbursement_history cascade;
drop table if exists public.reimbursement_cases cascade;
drop table if exists public.expense_reversals cascade;
drop table if exists public.expense_approvals cascade;
drop table if exists public.expense_lines cascade;
drop table if exists public.expense_requests cascade;
drop table if exists public.event_actual_expenses cascade;
drop table if exists public.meeting_action_history cascade;
drop table if exists public.meeting_actions cascade;
drop table if exists public.meeting_decisions cascade;
drop table if exists public.meeting_agenda cascade;
drop table if exists public.meeting_attendees cascade;
drop table if exists public.meetings cascade;
drop table if exists public.event_task_history cascade;
drop table if exists public.event_tasks cascade;
drop table if exists public.event_attendance cascade;
drop table if exists public.events cascade;
drop table if exists public.staff cascade;
drop table if exists public.committee_leave_history cascade;
drop table if exists public.committee_members cascade;
drop table if exists public.budgets cascade;
drop table if exists public.event_types cascade;
drop table if exists public.app_settings cascade;

create table public.app_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  budget_year int not null unique,
  category text not null default 'UnitedBML',
  approved_amount numeric(14,2) not null default 0,
  notes text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.committee_members (
  id text primary key,
  role text not null,
  group_name text,
  icon text,
  name text,
  uid text,
  contact text,
  email text,
  term_start date,
  term_end date,
  status text not null default 'Active',
  availability text not null default 'Available',
  leave_from date,
  leave_to date,
  notes text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.committee_leave_history (
  id uuid primary key default gen_random_uuid(),
  committee_member_id text references public.committee_members(id) on delete cascade,
  availability text not null,
  leave_from date,
  leave_to date,
  notes text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  uid text unique not null,
  full_name text not null,
  contact_no text,
  email text,
  status text not null default 'Active',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id text primary key,
  name text not null,
  event_type text,
  status text,
  auto_status text,
  manual_state text,
  event_date date,
  event_time time,
  venue text,
  coordinator text,
  coordinator_role text,
  coordinator_committee_id text,
  expected_participants int not null default 0,
  attendance_count int not null default 0,
  planned_budget numeric(14,2) not null default 0,
  description text,
  archived boolean not null default false,
  archived_at timestamptz,
  archive_reason text,
  cancelled_at timestamptz,
  finance_settlement_status text,
  settlement_reference text,
  actual_expense_total numeric(14,2) not null default 0,
  actual_expense_remarks text,
  actual_entered_by text,
  actual_entered_at timestamptz,
  finance_closed_at timestamptz,
  attendance_updated_at timestamptz,
  source_meeting_id text,
  source_meeting_title text,
  source_meeting_date date,
  source_agenda_id text,
  source_agenda_title text,
  source_agenda_outcome text,
  created_by uuid references auth.users(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  source_key text not null,
  task_text text not null,
  owner text,
  owner_role text,
  owner_committee_id text,
  due_date date,
  priority text,
  status text,
  done boolean not null default false,
  notes text,
  remarks text,
  availability text,
  source_meeting_id text,
  source_meeting_action_id text,
  source_meeting_action_status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,source_key)
);
create table public.event_task_history (
  id uuid primary key default gen_random_uuid(),
  event_task_id uuid not null references public.event_tasks(id) on delete cascade,
  action text,
  remarks text,
  actor_id uuid references auth.users(id),
  actor_name text,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
create table public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  staff_uid text not null,
  staff_name text not null,
  contact_no text,
  attendance_status text not null default 'Pending',
  attended boolean not null default false,
  marked_at timestamptz,
  marked_by uuid references auth.users(id),
  data jsonb not null default '{}'::jsonb,
  unique(event_id,staff_uid)
);
create table public.event_actual_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  line_type text not null default 'Vendor',
  source_key text not null,
  expense_item text not null,
  approved_amount numeric(14,2) not null default 0,
  actual_amount numeric(14,2) not null default 0,
  variance_amount numeric(14,2) not null default 0,
  vendor_number text,
  vendor_name text,
  reference text,
  entered_by uuid references auth.users(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(event_id,source_key)
);

create table public.meetings (
  id text primary key,
  title text not null,
  meeting_type text,
  meeting_date date,
  meeting_time time,
  location text,
  chair text,
  secretary text,
  purpose text,
  status text,
  minutes_finalized boolean not null default false,
  minutes_finalized_at timestamptz,
  cancelled boolean not null default false,
  cancelled_at timestamptz,
  minutes text,
  created_by uuid references auth.users(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id text not null references public.meetings(id) on delete cascade,
  source_key text not null,
  committee_id text,
  attendee_name text not null,
  attendee_uid text,
  attendee_role text,
  attendance_status text,
  data jsonb not null default '{}'::jsonb,
  unique(meeting_id,source_key)
);
create table public.meeting_agenda (
  id text primary key,
  source_key text not null,
  meeting_id text not null references public.meetings(id) on delete cascade,
  sort_order int not null default 0,
  title text not null,
  owner text,
  minutes_allocated int not null default 0,
  outcome text,
  details text,
  discussion text,
  event_id text,
  finance_id text,
  created_event_id text,
  carry_forward boolean not null default false,
  source_meeting_id text,
  source_meeting_title text,
  source_agenda_id text,
  source_agenda_title text,
  source_action_id text,
  source_action_text text,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
create table public.meeting_decisions (
  id text primary key,
  source_key text not null,
  meeting_id text not null references public.meetings(id) on delete cascade,
  agenda_id text references public.meeting_agenda(id) on delete set null,
  decision_text text not null,
  outcome text,
  owner text,
  event_id text,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
create table public.meeting_actions (
  id text primary key,
  source_key text not null,
  meeting_id text not null references public.meetings(id) on delete cascade,
  agenda_id text references public.meeting_agenda(id) on delete set null,
  action_text text not null,
  assigned_to text,
  assigned_role text,
  due_date date,
  priority text,
  status text not null default 'Open',
  done boolean not null default false,
  event_id text,
  remarks text,
  progress_note text,
  carried_forward_from text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.meeting_action_history (
  id uuid primary key default gen_random_uuid(),
  meeting_action_id text not null references public.meeting_actions(id) on delete cascade,
  action text,
  old_status text,
  new_status text,
  remarks text,
  changed_by uuid references auth.users(id),
  actor_name text,
  changed_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

create table public.expense_requests (
  id text primary key,
  request_number text unique,
  title text,
  event_id text references public.events(id) on delete set null,
  event_name text,
  request_date date,
  category text,
  purpose text,
  requested_by text,
  requester_role text,
  requested_by_user uuid references auth.users(id),
  prepared_by_name text,
  prepared_by_role text,
  prepared_at timestamptz,
  submitted_at timestamptz,
  status text not null default 'Draft',
  subtotal numeric(14,2) not null default 0,
  contingency_percent numeric(6,2) not null default 5,
  contingency_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  president_availability text,
  president_recommendation text,
  president_comment text,
  recommended_by_name text,
  recommended_by_role text,
  final_approver_name text,
  final_approver_role text,
  final_approver_email text,
  final_approver_comment text,
  final_approval_token text,
  final_approval_email_sent_at timestamptz,
  final_approval_email_sent_by text,
  final_approval_channel text,
  approved_by_name text,
  approved_by_role text,
  approved_at timestamptz,
  planned_event_budget numeric(14,2) not null default 0,
  previous_approved_event_spend numeric(14,2) not null default 0,
  projected_event_spend numeric(14,2) not null default 0,
  over_budget boolean not null default false,
  overrun_amount numeric(14,2) not null default 0,
  overrun_justification text,
  budget_available_before_approval numeric(14,2),
  budget_available_after_approval numeric(14,2),
  reversal_status text,
  reversal_reason text,
  reversal_requested_by text,
  reversal_requested_at timestamptz,
  reversal_president_comment text,
  reversed_by text,
  reversed_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.expense_lines (
  id uuid primary key default gen_random_uuid(),
  expense_request_id text not null references public.expense_requests(id) on delete cascade,
  line_no int not null,
  description text not null,
  quantity numeric(12,2) not null default 1,
  rate numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  vendor_number text,
  vendor text,
  reimbursement_required boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  unique(expense_request_id,line_no)
);
create table public.expense_approvals (
  id uuid primary key default gen_random_uuid(),
  expense_request_id text not null references public.expense_requests(id) on delete cascade,
  stage text not null,
  decision text not null,
  approver_name text,
  approver_role text,
  approver_user uuid references auth.users(id),
  comment text,
  channel text,
  decided_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
create table public.expense_reversals (
  id uuid primary key default gen_random_uuid(),
  expense_request_id text not null references public.expense_requests(id) on delete cascade,
  requested_by uuid references auth.users(id),
  requested_by_name text,
  reason text not null,
  status text not null default 'Pending President Approval',
  president_comment text,
  decided_by uuid references auth.users(id),
  decided_by_name text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  data jsonb not null default '{}'::jsonb
);

create table public.reimbursement_cases (
  id text primary key,
  case_ref text unique,
  reference_no text,
  expense_request_id text references public.expense_requests(id) on delete cascade,
  expense_request_number text,
  expense_line_no int,
  event_id text,
  event_name text,
  expense_item text,
  approved_item_amount numeric(14,2) not null default 0,
  route text not null default 'Standard',
  status text not null default 'Draft',
  reason text,
  expected_expense_date date,
  notes text,
  requested_by text,
  procurement_manager_email text,
  procurement_head_email text,
  email_reference text,
  email_attachment_name text,
  email_prepared_at timestamptz,
  procurement_comment text,
  procurement_response_by text,
  procurement_response_date date,
  exception_ref text,
  exception_reason text,
  exception_remarks text,
  exception_expense_date date,
  recorded_by text,
  recorded_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.reimbursement_history (
  id uuid primary key default gen_random_uuid(),
  reimbursement_id text not null references public.reimbursement_cases(id) on delete cascade,
  action text,
  status text,
  remarks text,
  actor_id uuid references auth.users(id),
  actor_name text,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
create table public.ap_batches (
  id text primary key,
  reimbursement_id text not null references public.reimbursement_cases(id) on delete cascade,
  submission_ref text,
  submission_date date,
  status text not null default 'Draft',
  ap_email text,
  email_remarks text,
  bills_attachment_name text,
  bills_attachment_type text,
  bills_attachment_stored boolean not null default false,
  bills_attachment_path text,
  sent_at timestamptz,
  status_date date,
  status_remarks text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ap_bills (
  id uuid primary key default gen_random_uuid(),
  ap_batch_id text not null references public.ap_batches(id) on delete cascade,
  line_no int not null,
  bill_date date,
  vendor_number text,
  vendor_name text,
  amount numeric(14,2) not null default 0,
  data jsonb not null default '{}'::jsonb,
  unique(ap_batch_id,line_no)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  related_type text not null,
  related_id text not null,
  file_name text not null,
  storage_bucket text,
  storage_path text,
  mime_type text,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);
create table public.email_log (
  id bigint generated by default as identity primary key,
  email_type text,
  related_type text,
  related_id text,
  to_email text not null,
  cc_email text,
  subject text not null,
  status text not null default 'Sent',
  provider text not null default 'Gmail',
  provider_message_id text,
  error_message text,
  sent_by uuid references auth.users(id),
  sent_at timestamptz not null default now()
);
create table public.audit_log (
  id bigint generated by default as identity primary key,
  entity_type text not null,
  entity_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  user_id uuid references auth.users(id),
  user_name text,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  message text,
  related_type text,
  related_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Blank structural configuration only. No operational/demo records are inserted.
insert into public.event_types(name,sort_order) values
 ('Sports',1),('Community',2),('Social',3),('Training',4),('CSR Activity',5),('Other',6)
on conflict(name) do nothing;
insert into public.committee_members(id,role,group_name,icon,name,uid,contact,email,status,availability,data) values
 ('chairperson','Chairperson','Executive','👑','','','','','Active','Available','{}'),
 ('vice_chairperson','Vice Chairperson','Executive','◆','','','','','Active','Available','{}'),
 ('president','President','Executive','★','','','','','Active','Available','{}'),
 ('treasurer','Treasurer','Executive','💰','','','','','Active','Available','{}'),
 ('secretary','Secretary','Executive','📝','','','','','Active','Available','{}'),
 ('male_coordinator_1','Male Coordinator 1','Male Coordination','📍','','','','','Active','Available','{}'),
 ('male_coordinator_2','Male Coordinator 2','Male Coordination','📍','','','','','Active','Available','{}'),
 ('communications_coordinator','Communications Coordinator','Communications','📣','','','','','Active','Available','{}'),
 ('atoll_coordinator','Atoll Coordinator','Atoll Coordination','🧭','','','','','Active','Available','{}'),
 ('atoll_representative_1','Atoll Representative 1','Atoll Representation','🏝️','','','','','Active','Available','{}'),
 ('atoll_representative_2','Atoll Representative 2','Atoll Representation','🏝️','','','','','Active','Available','{}'),
 ('atoll_representative_3','Atoll Representative 3','Atoll Representation','🏝️','','','','','Active','Available','{}')
on conflict(id) do nothing;

-- Indexes
create index idx_events_date on public.events(event_date);
create index idx_event_tasks_event on public.event_tasks(event_id);
create index idx_event_attendance_event on public.event_attendance(event_id);
create index idx_meetings_date on public.meetings(meeting_date);
create index idx_meeting_actions_due on public.meeting_actions(due_date,status);
create index idx_expense_status on public.expense_requests(status);
create index idx_expense_event on public.expense_requests(event_id);
create index idx_reimb_expense on public.reimbursement_cases(expense_request_id);
create index idx_ap_reimb on public.ap_batches(reimbursement_id);
create index idx_audit_entity on public.audit_log(entity_type,entity_id);

-- RLS
alter table public.profiles enable row level security;
do $$ declare t text; begin
  foreach t in array array['app_settings','event_types','budgets','committee_members','committee_leave_history','staff','events','event_tasks','event_task_history','event_attendance','event_actual_expenses','meetings','meeting_attendees','meeting_agenda','meeting_decisions','meeting_actions','meeting_action_history','expense_requests','expense_lines','expense_approvals','expense_reversals','reimbursement_cases','reimbursement_history','ap_batches','ap_bills','attachments','email_log','audit_log','notifications'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all to authenticated using (public.current_role()='Administrator') with check (public.current_role()='Administrator');

-- General operational visibility.
do $$ declare t text; begin
  foreach t in array array['event_types','committee_members','staff','events','event_tasks','event_task_history','event_attendance','event_actual_expenses','meetings','meeting_attendees','meeting_agenda','meeting_decisions','meeting_actions','meeting_action_history'] loop
    execute format('create policy auth_read on public.%I for select to authenticated using (true)',t);
    execute format('create policy committee_write on public.%I for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user())',t);
  end loop;
end $$;

-- Committee-only finance/procurement records.
do $$ declare t text; begin
  foreach t in array array['app_settings','budgets','committee_leave_history','expense_requests','expense_lines','expense_approvals','expense_reversals','reimbursement_cases','reimbursement_history','ap_batches','ap_bills','attachments','email_log','audit_log'] loop
    execute format('create policy committee_read on public.%I for select to authenticated using (public.is_committee_user())',t);
    execute format('create policy committee_write on public.%I for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user())',t);
  end loop;
end $$;

create policy notification_read on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notification_update on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

comment on table public.events is 'ClubSphere event/activity master. All editable HTML fields are represented by columns; data is a lossless compatibility snapshot.';
comment on table public.expense_requests is 'ClubSphere expense request header including 5% contingency, President recommendation, final approval, budget overrun and reversal fields.';
comment on table public.reimbursement_cases is 'ClubSphere reimbursement/procurement case with AP batches in normalized child tables.';
