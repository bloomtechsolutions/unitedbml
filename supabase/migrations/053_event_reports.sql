-- UnitedBML: Event Completion Reports — after an event's Finance settlement closes, the
-- coordinator submits attendance/volunteer counts, feedback and recommendations, with photos,
-- and the President signs off. Exported as a PDF from the app.

create table public.event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique references public.events(id) on delete cascade,
  staff_attended int not null default 0,
  volunteers_count int not null default 0,
  no_show_count int not null default 0,
  highlights text,
  feedback_rating int check (feedback_rating between 1 and 5),
  feedback_text text,
  challenges text,
  recommendations text,
  status text not null default 'Draft' check (status in ('Draft', 'Submitted', 'Approved', 'Returned')),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_name text,
  submitted_at timestamptz,
  president_decision text,
  president_comment text,
  decided_by_name text,
  decided_by_role text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_reports_status_idx on public.event_reports(status);

alter table public.event_reports enable row level security;
drop policy if exists event_reports_read on public.event_reports;
drop policy if exists event_reports_write on public.event_reports;
create policy event_reports_read on public.event_reports for select to authenticated using (public.is_committee_user());
create policy event_reports_write on public.event_reports for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user());

create table public.event_report_photos (
  id uuid primary key default gen_random_uuid(),
  event_report_id uuid not null references public.event_reports(id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order int not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index event_report_photos_report_idx on public.event_report_photos(event_report_id);

alter table public.event_report_photos enable row level security;
drop policy if exists event_report_photos_read on public.event_report_photos;
drop policy if exists event_report_photos_write on public.event_report_photos;
create policy event_report_photos_read on public.event_report_photos for select to authenticated using (public.is_committee_user());
create policy event_report_photos_write on public.event_report_photos for all to authenticated using (public.is_committee_user()) with check (public.is_committee_user());

-- Storage bucket for report photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-report-photos', 'event-report-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists event_report_photos_storage_read on storage.objects;
drop policy if exists event_report_photos_storage_insert on storage.objects;
drop policy if exists event_report_photos_storage_update on storage.objects;
drop policy if exists event_report_photos_storage_delete on storage.objects;

create policy event_report_photos_storage_read on storage.objects
for select to authenticated using (bucket_id = 'event-report-photos' and public.is_committee_user());
create policy event_report_photos_storage_insert on storage.objects
for insert to authenticated with check (bucket_id = 'event-report-photos' and public.is_committee_user());
create policy event_report_photos_storage_update on storage.objects
for update to authenticated using (bucket_id = 'event-report-photos' and public.is_committee_user()) with check (bucket_id = 'event-report-photos' and public.is_committee_user());
create policy event_report_photos_storage_delete on storage.objects
for delete to authenticated using (bucket_id = 'event-report-photos' and public.is_committee_user());

-- Auto-create a Draft report (prefilled with attendance) and notify the coordinator the moment
-- an event's Finance settlement closes — the one concrete, reliably-stored "event is done" signal
-- (event lifecycle itself is computed client-side from several factors, not a single column).
create or replace function public.notify_coordinator_on_settlement_close()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare
  v_report_id uuid;
  v_coordinator_user_id uuid;
begin
  if new.finance_settlement_status = 'Closed' and coalesce(old.finance_settlement_status, '') <> 'Closed' then
    insert into public.event_reports (event_id, staff_attended, no_show_count)
    values (
      new.id,
      coalesce(new.attendance_count, 0),
      greatest(coalesce(new.expected_participants, 0) - coalesce(new.attendance_count, 0), 0)
    )
    on conflict (event_id) do nothing
    returning id into v_report_id;

    if v_report_id is null then
      select id into v_report_id from public.event_reports where event_id = new.id;
    end if;

    if new.coordinator_committee_id is not null then
      select user_id into v_coordinator_user_id from public.committee_members where id = new.coordinator_committee_id;
    end if;

    if v_coordinator_user_id is not null then
      insert into public.notifications (user_id, title, message, related_type, related_id)
      values (
        v_coordinator_user_id,
        'Event Report needed',
        new.name || ' has closed out financially — submit the completion report.',
        'event_report',
        v_report_id::text
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_coordinator_on_settlement_close on public.events;
create trigger trg_notify_coordinator_on_settlement_close
after update of finance_settlement_status on public.events
for each row execute function public.notify_coordinator_on_settlement_close();

-- Notify the President when a report is submitted for sign-off, and the coordinator back when
-- their report is returned.
create or replace function public.notify_on_event_report_status_change()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare
  v_event_name text;
begin
  select name into v_event_name from public.events where id = new.event_id;

  if new.status = 'Submitted' and coalesce(old.status, '') <> 'Submitted' then
    insert into public.notifications (user_id, title, message, related_type, related_id)
    select cm.user_id,
           'Event Report awaiting sign-off',
           coalesce(v_event_name, 'An event') || ' report was submitted by ' || coalesce(new.submitted_by_name, 'the coordinator') || '.',
           'event_report',
           new.id::text
    from public.committee_members cm
    where cm.role = 'President' and cm.user_id is not null;
  end if;

  if new.status = 'Returned' and coalesce(old.status, '') <> 'Returned' and new.submitted_by is not null then
    insert into public.notifications (user_id, title, message, related_type, related_id)
    values (
      new.submitted_by,
      'Event Report returned',
      coalesce(v_event_name, 'An event') || ' report was returned' || coalesce(': ' || new.president_comment, '.'),
      'event_report',
      new.id::text
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_on_event_report_status_change on public.event_reports;
create trigger trg_notify_on_event_report_status_change
after update of status on public.event_reports
for each row execute function public.notify_on_event_report_status_change();
