\
-- UnitedBML V12.10.6
-- Resolve Tournament Department Engagement from the current Staff Master.

-- 1. Backfill existing tournament registrations with missing Department.
update public.tournament_registrations r
set department = s.department
from public.staff s
where nullif(trim(coalesce(r.department,'')),'') is null
  and nullif(trim(coalesce(s.department,'')),'') is not null
  and (
    (nullif(trim(coalesce(r.staff_uid,'')),'') is not null and s.uid = r.staff_uid)
    or
    (nullif(trim(coalesce(r.email,'')),'') is not null and lower(s.email)=lower(r.email))
  );

-- 2. Future team creators must use normalized Staff Master columns.
create or replace function public.create_tournament_team(p_tournament_id text, p_team_name text)
returns public.tournament_teams
language plpgsql security definer set search_path=public as $$
declare
  me public.profiles;
  s public.staff;
  team public.tournament_teams;
  code text;
  team_id text;
  mode text;
  tstatus text;
begin
  select * into me from public.profiles where id=auth.uid();
  if me.id is null or lower(coalesce(me.status,'Active'))='inactive' then raise exception 'Active UnitedBML login required'; end if;
  select tournament_mode,status into mode,tstatus from public.tournaments where id=p_tournament_id;
  if mode<>'Teams' then raise exception 'This tournament is not in Team registration mode'; end if;
  if tstatus<>'Registration Open' then raise exception 'Tournament registration is not open'; end if;
  if exists(select 1 from public.tournament_registrations where tournament_id=p_tournament_id and user_id=auth.uid()) then raise exception 'You already have a registration for this tournament'; end if;

  select * into s
  from public.staff
  where (me.member_uid is not null and uid=me.member_uid)
     or lower(email)=lower(me.email)
  order by case when me.member_uid is not null and uid=me.member_uid then 0 else 1 end
  limit 1;

  team_id := 'TEAM-' || replace(gen_random_uuid()::text,'-','');
  code := upper(left(regexp_replace(coalesce(p_team_name,'TEAM'),'[^A-Za-z]','','g'),3)) || '-' || lpad((floor(random()*9000)+1000)::int::text,4,'0');

  insert into public.tournament_teams(id,tournament_id,team_name,join_code,leader_user_id,leader_uid,leader_name,leader_email,status)
  values(team_id,p_tournament_id,trim(p_team_name),code,auth.uid(),coalesce(me.member_uid,s.uid),coalesce(nullif(me.full_name,''),s.full_name,me.email),me.email,'Open')
  returning * into team;

  insert into public.tournament_registrations(tournament_id,user_id,staff_uid,staff_name,email,contact_no,department,registration_type,team_id,status)
  values(
    p_tournament_id,
    auth.uid(),
    coalesce(me.member_uid,s.uid),
    coalesce(nullif(me.full_name,''),s.full_name,me.email),
    me.email,
    coalesce(me.contact_no,s.contact_no),
    coalesce(nullif(trim(s.department),''), nullif(trim(s.data->>'department'),'')),
    'Team',team_id,'Approved'
  );

  return team;
end $$;
grant execute on function public.create_tournament_team(text,text) to authenticated;

-- 3. Public Tournament stats resolve Department dynamically from Staff Master.
--    This means staff transfers/department corrections are reflected without
--    editing historical registration rows.
create or replace function public.get_tournament_public_stats(p_tournament_id text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'registrations',(select count(*) from public.tournament_registrations r where r.tournament_id=p_tournament_id and r.status='Approved'),
    'pending',(select count(*) from public.tournament_registrations r where r.tournament_id=p_tournament_id and r.status='Pending Leader Approval'),
    'teams',(select count(*) from public.tournament_teams t where t.tournament_id=p_tournament_id and t.status<>'Withdrawn'),
    'teamCounts',coalesce((select jsonb_agg(jsonb_build_object('teamId',x.team_id,'count',x.cnt)) from (
      select r.team_id,count(*) cnt from public.tournament_registrations r where r.tournament_id=p_tournament_id and r.team_id is not null and r.status='Approved' group by r.team_id
    ) x),'[]'::jsonb),
    'completedMatches',(select count(*) from public.tournament_matches m where m.tournament_id=p_tournament_id and m.status='Completed'),
    'departments',coalesce((select jsonb_agg(jsonb_build_object('department',x.department,'count',x.cnt) order by x.cnt desc,x.department) from (
      select
        coalesce(
          nullif(trim(s.department),''),
          nullif(trim(r.department),''),
          'Staff Master Missing Department'
        ) department,
        count(*) cnt
      from public.tournament_registrations r
      left join lateral (
        select st.department
        from public.staff st
        where (nullif(trim(coalesce(r.staff_uid,'')),'') is not null and st.uid=r.staff_uid)
           or (nullif(trim(coalesce(r.email,'')),'') is not null and lower(st.email)=lower(r.email))
        order by case when nullif(trim(coalesce(r.staff_uid,'')),'') is not null and st.uid=r.staff_uid then 0 else 1 end
        limit 1
      ) s on true
      where r.tournament_id=p_tournament_id and r.status='Approved'
      group by coalesce(nullif(trim(s.department),''),nullif(trim(r.department),''),'Staff Master Missing Department')
    ) x),'[]'::jsonb)
  )
$$;
grant execute on function public.get_tournament_public_stats(text) to authenticated;
