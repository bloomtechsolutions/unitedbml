-- UnitedBML V12.8.3
-- Tournament team approval compatibility repair.
--
-- Older Tournament installations may have UUID team ids, while focused V12
-- uses text team ids. All comparisons below are normalized through ::text so
-- both schemas work safely.

-- Remove potentially stale overloads from earlier builds.
drop function if exists public.is_tournament_team_leader(uuid);
drop function if exists public.is_tournament_team_member(uuid);

create or replace function public.is_tournament_team_leader(p_team_id text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.tournament_teams t
    where t.id::text = p_team_id::text
      and (
        t.leader_user_id = auth.uid()
        or lower(coalesce(t.leader_email,'')) = public.current_profile_email()
      )
  )
$$;

create or replace function public.is_tournament_team_member(p_team_id text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.tournament_registrations r
    where r.team_id::text = p_team_id::text
      and (
        r.user_id = auth.uid()
        or lower(coalesce(r.email,'')) = public.current_profile_email()
      )
      and r.status='Approved'
  )
  or public.is_tournament_team_leader(p_team_id)
$$;

grant execute on function public.is_tournament_team_leader(text) to authenticated;
grant execute on function public.is_tournament_team_member(text) to authenticated;

-- UUID overloads are intentionally supplied for older schemas/policies.
-- They simply delegate to the text-safe implementation.
create or replace function public.is_tournament_team_leader(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_tournament_team_leader(p_team_id::text)
$$;

create or replace function public.is_tournament_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_tournament_team_member(p_team_id::text)
$$;

grant execute on function public.is_tournament_team_leader(uuid) to authenticated;
grant execute on function public.is_tournament_team_member(uuid) to authenticated;

-- Approval function is text-normalized so both legacy text IDs and current UUID IDs work.
drop function if exists public.approve_tournament_team_request(uuid,text);
drop function if exists public.approve_tournament_team_request(text,text);

create function public.approve_tournament_team_request(p_registration_id text,p_decision text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  registration_team_id text;
  registration_status text;
  leader_uid uuid;
  leader_email_value text;
  normalized_decision text;
begin
  select r.team_id::text,r.status into registration_team_id,registration_status
  from public.tournament_registrations r
  where r.id::text=p_registration_id::text for update;
  if registration_team_id is null then raise exception 'Registration request not found'; end if;

  select t.leader_user_id,lower(coalesce(t.leader_email,'')) into leader_uid,leader_email_value
  from public.tournament_teams t where t.id::text=registration_team_id::text limit 1;
  if not public.is_committee_user() and not (leader_uid=auth.uid() or leader_email_value=public.current_profile_email()) then
    raise exception 'Only the Team Leader or Committee can approve this request';
  end if;
  if registration_status<>'Pending Leader Approval' then raise exception 'This request is no longer pending'; end if;

  normalized_decision:=lower(trim(coalesce(p_decision,'')));
  if normalized_decision in ('reject','rejected','no','false')
     and (leader_uid=auth.uid() or leader_email_value=public.current_profile_email()) then
    raise exception 'Team Leaders can approve join requests only. Another Committee member may reject the request.';
  end if;
  if normalized_decision in ('approve','approved','yes','true') then
    update public.tournament_registrations set status='Approved',decided_at=now(),decided_by=auth.uid() where id::text=p_registration_id::text;
    return jsonb_build_object('ok',true,'status','Approved');
  elsif normalized_decision in ('reject','rejected','no','false') then
    update public.tournament_registrations set status='Rejected',decided_at=now(),decided_by=auth.uid() where id::text=p_registration_id::text;
    return jsonb_build_object('ok',true,'status','Rejected');
  else
    raise exception 'Invalid team decision: %',p_decision;
  end if;
end $$;
grant execute on function public.approve_tournament_team_request(text,text) to authenticated;

-- Recreate focused RLS policies using the compatibility helpers.
drop policy if exists registrations_read on public.tournament_registrations;
create policy registrations_read
on public.tournament_registrations
for select
to authenticated
using (
  public.is_committee_user()
  or user_id=auth.uid()
  or lower(coalesce(email,''))=public.current_profile_email()
  or public.is_tournament_team_leader(team_id::text)
  or (
    status='Approved'
    and public.is_tournament_team_member(team_id::text)
  )
);

drop policy if exists team_messages_read on public.tournament_team_messages;
create policy team_messages_read
on public.tournament_team_messages
for select
to authenticated
using (
  public.is_committee_user()
  or public.is_tournament_team_member(team_id::text)
);

drop policy if exists team_messages_insert on public.tournament_team_messages;
create policy team_messages_insert
on public.tournament_team_messages
for insert
to authenticated
with check (
  user_id=auth.uid()
  and (
    public.is_committee_user()
    or public.is_tournament_team_member(team_id::text)
  )
);

drop policy if exists teams_update on public.tournament_teams;
create policy teams_update
on public.tournament_teams
for update
to authenticated
using (
  public.is_committee_user()
  or public.is_tournament_team_leader(id::text)
)
with check (
  public.is_committee_user()
  or leader_user_id=auth.uid()
  or lower(coalesce(leader_email,''))=public.current_profile_email()
);
