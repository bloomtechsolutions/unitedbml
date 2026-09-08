-- UnitedBML V12.8.4
-- Final Tournament Team Leader controls + legacy id compatibility.
-- Supports databases where tournament_registrations.id or tournament_teams.id
-- may be UUID or text due to earlier Tournament versions.

-- Remove the UUID-only approval signature that can cause text = uuid errors.
drop function if exists public.approve_tournament_team_request(uuid,text);
drop function if exists public.approve_tournament_team_request(text,text);

create function public.approve_tournament_team_request(
  p_registration_id text,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  registration_team_id text;
  registration_status text;
  leader_uid uuid;
  leader_email_value text;
  normalized_decision text;
begin
  -- Text-normalized lookup works whether the underlying id column is uuid or text.
  select r.team_id::text, r.status
    into registration_team_id, registration_status
    from public.tournament_registrations r
   where r.id::text = p_registration_id::text
   for update;

  if registration_team_id is null then
    raise exception 'Registration request not found';
  end if;

  select t.leader_user_id, lower(coalesce(t.leader_email,''))
    into leader_uid, leader_email_value
    from public.tournament_teams t
   where t.id::text = registration_team_id::text
   limit 1;

  if leader_uid is null and coalesce(leader_email_value,'')='' then
    raise exception 'Team not found';
  end if;

  if not public.is_committee_user()
     and not (
       leader_uid = auth.uid()
       or leader_email_value = public.current_profile_email()
     ) then
    raise exception 'Only the Team Leader or Committee can approve this request';
  end if;

  if registration_status <> 'Pending Leader Approval' then
    raise exception 'This request is no longer pending';
  end if;

  normalized_decision := lower(trim(coalesce(p_decision,'')));

  -- Team Leaders are intentionally approve-only.
  if normalized_decision in ('reject','rejected','no','false')
     and (leader_uid=auth.uid() or leader_email_value=public.current_profile_email()) then
    raise exception 'Team Leaders can approve join requests only. Another Committee member may reject the request.';
  end if;

  if normalized_decision in ('approve','approved','yes','true') then
    update public.tournament_registrations
       set status='Approved', decided_at=now(), decided_by=auth.uid()
     where id::text=p_registration_id::text;
    return jsonb_build_object('ok',true,'status','Approved');
  elsif normalized_decision in ('reject','rejected','no','false') then
    update public.tournament_registrations
       set status='Rejected', decided_at=now(), decided_by=auth.uid()
     where id::text=p_registration_id::text;
    return jsonb_build_object('ok',true,'status','Rejected');
  else
    raise exception 'Invalid team decision: %', p_decision;
  end if;
end
$$;

grant execute on function public.approve_tournament_team_request(text,text) to authenticated;

-- Team Leader / Committee member removal.
drop function if exists public.remove_tournament_team_member(uuid,text);
drop function if exists public.remove_tournament_team_member(text,text);

create function public.remove_tournament_team_member(
  p_registration_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  registration_team_id text;
  member_user_id uuid;
  member_status text;
  leader_uid uuid;
  leader_email_value text;
  actor_name text;
begin
  select r.team_id::text, r.user_id, r.status
    into registration_team_id, member_user_id, member_status
    from public.tournament_registrations r
   where r.id::text=p_registration_id::text
   for update;

  if registration_team_id is null then
    raise exception 'Team member registration not found';
  end if;

  select t.leader_user_id, lower(coalesce(t.leader_email,''))
    into leader_uid, leader_email_value
    from public.tournament_teams t
   where t.id::text=registration_team_id::text
   limit 1;

  if not public.is_committee_user()
     and not (
       leader_uid=auth.uid()
       or leader_email_value=public.current_profile_email()
     ) then
    raise exception 'Only the Team Leader or Committee can remove a member';
  end if;

  if member_user_id=leader_uid then
    raise exception 'The Team Leader cannot be removed from their own team';
  end if;

  if member_status<>'Approved' then
    raise exception 'Only approved team members can be removed';
  end if;

  update public.tournament_registrations
     set status='Withdrawn',
         team_id=null,
         decided_at=now(),
         decided_by=auth.uid(),
         data=coalesce(data,'{}'::jsonb)||jsonb_build_object(
           'removedFromTeam',true,
           'removedAt',now(),
           'removalReason',coalesce(p_reason,'')
         )
   where id::text=p_registration_id::text;

  select coalesce(full_name,email,'Committee') into actor_name
    from public.profiles where id=auth.uid();

  return jsonb_build_object('ok',true,'status','Withdrawn','removed_by',actor_name);
end
$$;

grant execute on function public.remove_tournament_team_member(text,text) to authenticated;

-- Keep helper functions text-safe in case older policies are still present.
create or replace function public.is_tournament_team_leader(p_team_id text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.tournament_teams t
    where t.id::text=p_team_id::text
      and (
        t.leader_user_id=auth.uid()
        or lower(coalesce(t.leader_email,''))=public.current_profile_email()
      )
  )
$$;

create or replace function public.is_tournament_team_member(p_team_id text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.tournament_registrations r
    where r.team_id::text=p_team_id::text
      and (
        r.user_id=auth.uid()
        or lower(coalesce(r.email,''))=public.current_profile_email()
      )
      and r.status='Approved'
  ) or public.is_tournament_team_leader(p_team_id)
$$;

grant execute on function public.is_tournament_team_leader(text) to authenticated;
grant execute on function public.is_tournament_team_member(text) to authenticated;
