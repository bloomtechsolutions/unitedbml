\
-- UnitedBML V12.9.5
-- Committee members can manage only their own leave from Settings.

create or replace function public.get_my_committee_leave()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  me auth.users;
  p public.profiles;
  c public.committee_members;
begin
  select * into me from auth.users where id=auth.uid();
  if me.id is null then raise exception 'No authenticated user'; end if;

  select * into p from public.profiles where id=auth.uid();

  select *
    into c
    from public.committee_members cm
   where cm.status='Active'
     and (
       cm.user_id=auth.uid()
       or (
         p.member_uid is not null
         and coalesce(cm.staff_uid,cm.uid)=p.member_uid
       )
       or lower(coalesce(cm.email,''))=lower(coalesce(p.email,me.email,''))
     )
   order by
     case when cm.user_id=auth.uid() then 0 else 1 end,
     case when p.member_uid is not null and coalesce(cm.staff_uid,cm.uid)=p.member_uid then 0 else 1 end
   limit 1;

  if c.id is null then
    return jsonb_build_object(
      'isCommitteeMember',false
    );
  end if;

  return jsonb_build_object(
    'isCommitteeMember',true,
    'committeeId',c.id,
    'position',c.role,
    'group',c.group_name,
    'availability',coalesce(c.availability,'Available'),
    'leaveFrom',c.leave_from,
    'leaveTo',c.leave_to,
    'notes',coalesce(c.notes,'')
  );
end
$$;

create or replace function public.update_my_committee_leave(
  p_leave_from date,
  p_leave_to date
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.profiles;
  c public.committee_members;
begin
  if auth.uid() is null then raise exception 'No authenticated user'; end if;

  if p_leave_from is null or p_leave_to is null then
    raise exception 'Select both Leave From and Leave To dates';
  end if;

  if p_leave_to < p_leave_from then
    raise exception 'Leave To date cannot be before Leave From date';
  end if;

  select * into p from public.profiles where id=auth.uid();

  select *
    into c
    from public.committee_members cm
   where cm.status='Active'
     and (
       cm.user_id=auth.uid()
       or (
         p.member_uid is not null
         and coalesce(cm.staff_uid,cm.uid)=p.member_uid
       )
       or lower(coalesce(cm.email,''))=lower(coalesce(p.email,''))
     )
   order by
     case when cm.user_id=auth.uid() then 0 else 1 end,
     case when p.member_uid is not null and coalesce(cm.staff_uid,cm.uid)=p.member_uid then 0 else 1 end
   limit 1
   for update;

  if c.id is null then
    raise exception 'You are not assigned to an active UnitedBML Committee position';
  end if;

  update public.committee_members
     set user_id=coalesce(user_id,auth.uid()),
         staff_uid=coalesce(staff_uid,uid,p.member_uid),
         availability='On Leave',
         leave_from=p_leave_from,
         leave_to=p_leave_to,
         data=coalesce(data,'{}'::jsonb) || jsonb_build_object(
           'availability','On Leave',
           'leaveFrom',p_leave_from,
           'leaveTo',p_leave_to,
           'leaveUpdatedBy','Self Service Settings',
           'leaveUpdatedAt',now()
         ),
         updated_at=now()
   where id=c.id;

  return jsonb_build_object(
    'ok',true,
    'committeeId',c.id,
    'position',c.role,
    'availability','On Leave',
    'leaveFrom',p_leave_from,
    'leaveTo',p_leave_to
  );
end
$$;

create or replace function public.clear_my_committee_leave()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.profiles;
  c public.committee_members;
begin
  if auth.uid() is null then raise exception 'No authenticated user'; end if;

  select * into p from public.profiles where id=auth.uid();

  select *
    into c
    from public.committee_members cm
   where cm.status='Active'
     and (
       cm.user_id=auth.uid()
       or (
         p.member_uid is not null
         and coalesce(cm.staff_uid,cm.uid)=p.member_uid
       )
       or lower(coalesce(cm.email,''))=lower(coalesce(p.email,''))
     )
   order by
     case when cm.user_id=auth.uid() then 0 else 1 end,
     case when p.member_uid is not null and coalesce(cm.staff_uid,cm.uid)=p.member_uid then 0 else 1 end
   limit 1
   for update;

  if c.id is null then
    raise exception 'You are not assigned to an active UnitedBML Committee position';
  end if;

  update public.committee_members
     set availability='Available',
         leave_from=null,
         leave_to=null,
         data=(coalesce(data,'{}'::jsonb) - 'leaveFrom' - 'leaveTo')
           || jsonb_build_object(
             'availability','Available',
             'leaveUpdatedBy','Self Service Settings',
             'leaveUpdatedAt',now()
           ),
         updated_at=now()
   where id=c.id;

  return jsonb_build_object(
    'ok',true,
    'committeeId',c.id,
    'position',c.role,
    'availability','Available'
  );
end
$$;

grant execute on function public.get_my_committee_leave() to authenticated;
grant execute on function public.update_my_committee_leave(date,date) to authenticated;
grant execute on function public.clear_my_committee_leave() to authenticated;

comment on function public.update_my_committee_leave(date,date) is
'Self-service Committee leave update. The authenticated user can update only their own linked active Committee assignment.';
