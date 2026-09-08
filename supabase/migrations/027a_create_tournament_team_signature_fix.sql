-- UnitedBML V12.9.1
-- Repair for:
-- ERROR 42P13: cannot change return type of existing function
-- HINT: Use DROP FUNCTION create_tournament_team(text,text) first.
--
-- Safe to run after V12.9 migration stopped at create_tournament_team.

drop function if exists public.create_tournament_team(text,text);

create function public.create_tournament_team(
  p_tournament_id text,
  p_team_name text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.tournaments;
  me public.profiles;
  s public.staff;
  team_id text;
  code text;
begin
  select * into t from public.tournaments where id::text=p_tournament_id::text;
  if t.id is null then raise exception 'Tournament not found'; end if;
  if t.status<>'Registration Open' then raise exception 'Tournament registration is not open'; end if;
  if lower(coalesce(t.tournament_mode,''))<>'teams' then raise exception 'This tournament is not using Team registration'; end if;
  if not public.is_staff_eligible_for_tournament(t.id::text,auth.uid()) then
    if public.staff_audience_for_user(auth.uid())='UNCLASSIFIED' then
      raise exception 'Your staff location classification has not yet been configured. Please contact UnitedBML.';
    end if;
    raise exception 'You are not eligible to create a team for this tournament.';
  end if;

  select * into me from public.profiles where id=auth.uid();
  select * into s from public.staff
   where (me.member_uid is not null and uid=me.member_uid)
      or lower(coalesce(email,''))=lower(coalesce(me.email,''))
   order by case when me.member_uid is not null and uid=me.member_uid then 0 else 1 end
   limit 1;

  team_id := 'TEAM-'||replace(gen_random_uuid()::text,'-','');
  code := upper(substr(regexp_replace(coalesce(p_team_name,'TEAM'),'[^A-Za-z0-9]','','g'),1,3))
          ||'-'||lpad((floor(random()*10000))::int::text,4,'0');

  insert into public.tournament_teams(
    id,tournament_id,team_name,join_code,leader_user_id,leader_uid,
    leader_name,leader_email,status
  )
  values(
    team_id,t.id::text,trim(p_team_name),code,auth.uid(),
    coalesce(me.member_uid,s.uid),
    coalesce(nullif(me.full_name,''),s.full_name,me.email),
    me.email,'Open'
  );

  insert into public.tournament_registrations(
    tournament_id,user_id,staff_uid,staff_name,email,contact_no,department,
    registration_type,team_id,status
  )
  values(
    t.id::text,auth.uid(),coalesce(me.member_uid,s.uid),
    coalesce(nullif(me.full_name,''),s.full_name,me.email),me.email,
    coalesce(me.contact_no,s.contact_no),public.staff_department_for_user(auth.uid()),
    'Team',team_id,'Approved'
  );

  return jsonb_build_object('ok',true,'team_id',team_id,'join_code',code);
end $$;

grant execute on function public.create_tournament_team(text,text) to authenticated;
