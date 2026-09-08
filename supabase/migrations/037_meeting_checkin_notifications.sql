-- UnitedBML: self check-in for meeting attendance, plus a scheduling notification
-- for every expected attendee who has a linked authenticated account.

-- Resolve the caller's own committee_members row (via the user_id link added in
-- migration 029) and mark THEIR OWN attendee row Present. Scoped this way rather
-- than a direct client update so one committee member can never mark another's
-- attendance, even though the existing committee_manage RLS policy on
-- meeting_attendees would otherwise allow any committee user to write any row.
create or replace function public.check_in_to_meeting(p_meeting_id text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  my_committee_id text;
  attendee_row public.meeting_attendees;
begin
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

-- Notify every expected attendee with a linked account that a meeting is scheduled.
-- Committee-only (the person scheduling/editing the meeting triggers this).
create or replace function public.notify_meeting_attendees(p_meeting_id text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  m public.meetings;
  n int;
begin
  if not public.is_committee_user() then raise exception 'Committee access required'; end if;
  select * into m from public.meetings where id = p_meeting_id;
  if m.id is null then raise exception 'Meeting not found'; end if;

  insert into public.notifications(user_id, title, message, related_type, related_id)
  select c.user_id,
    'Meeting scheduled: ' || m.title,
    trim(both ' ' from
      coalesce(to_char(m.meeting_date,'DD Mon YYYY'),'') || ' ' ||
      coalesce(to_char(m.meeting_time,'HH24:MI'),'') ||
      case when m.location is not null and m.location <> '' then ' · ' || m.location else '' end
    ) || ' — check in when you arrive.',
    'meeting',
    m.id
  from public.meeting_attendees a
  join public.committee_members c on c.id = a.committee_id
  where a.meeting_id = m.id and c.user_id is not null;

  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'notified', n);
end $$;
grant execute on function public.notify_meeting_attendees(text) to authenticated;
