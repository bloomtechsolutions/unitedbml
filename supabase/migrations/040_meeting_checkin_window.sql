-- UnitedBML: enforce a fixed self check-in window for meetings server-side (the client already
-- hides/disables the Check In button outside this window, but the RPC is the actual guard) —
-- opens 5 minutes before the scheduled start, closes the moment the meeting is closed (minutes
-- finalized) or cancelled. Anyone still Expected when a meeting closes is left Absent rather than
-- being able to check in after the fact.

create or replace function public.check_in_to_meeting(p_meeting_id text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  my_committee_id text;
  attendee_row public.meeting_attendees;
  m public.meetings;
  opens_at timestamptz;
begin
  select * into m from public.meetings where id = p_meeting_id;
  if m.id is null then
    raise exception 'Meeting not found.';
  end if;
  if m.cancelled then
    raise exception 'This meeting was cancelled.';
  end if;
  if m.minutes_finalized then
    raise exception 'This meeting has already closed. You are recorded as absent.';
  end if;
  if m.meeting_date is null then
    raise exception 'This meeting has no scheduled time yet.';
  end if;

  opens_at := (m.meeting_date + coalesce(m.meeting_time, '00:00:00'::time)) - interval '5 minutes';
  if now() < opens_at then
    raise exception 'Check-in opens at %.', to_char(opens_at, 'HH24:MI');
  end if;

  select id into my_committee_id from public.committee_members where user_id = auth.uid() limit 1;
  if my_committee_id is null then
    raise exception 'You are not linked to a Committee position, so you cannot self check-in.';
  end if;

  select * into attendee_row from public.meeting_attendees
    where meeting_id = p_meeting_id and committee_id = my_committee_id
    limit 1;
  if attendee_row.id is null then
    raise exception 'You are not on the attendee list for this meeting.';
  end if;

  update public.meeting_attendees
     set attendance_status = 'Present',
         data = coalesce(data,'{}'::jsonb) || jsonb_build_object('checkedInAt', now())
   where id = attendee_row.id;

  return jsonb_build_object('ok', true, 'attendeeId', attendee_row.id);
end $$;
grant execute on function public.check_in_to_meeting(text) to authenticated;

-- Whoever never checked in by the time the meeting closes is marked Absent.
create or replace function public.mark_absent_on_meeting_close()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  if new.minutes_finalized and not coalesce(old.minutes_finalized, false) then
    update public.meeting_attendees
       set attendance_status = 'Absent'
     where meeting_id = new.id
       and coalesce(attendance_status, 'Expected') not in ('Present', 'Absent', 'Excused');
  end if;
  return new;
end $$;

drop trigger if exists trg_mark_absent_on_meeting_close on public.meetings;
create trigger trg_mark_absent_on_meeting_close
after update of minutes_finalized on public.meetings
for each row execute function public.mark_absent_on_meeting_close();
