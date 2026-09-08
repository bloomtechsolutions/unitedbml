-- UnitedBML extended final approver pool
-- Adds three HR Head positions as Committee final approvers.
-- Final approval remains one selected person per expense.

insert into public.committee_members
  (id,role,group_name,icon,name,uid,contact,email,status,availability,data,updated_at)
values
  ('head_total_rewards_er','Head of Total Rewards & Employee Relations','Final Approvers','',null,null,null,null,'Active','Available','{}'::jsonb,now()),
  ('head_talent_acquisition_pd','Head of Talent Acquisition & People Development','Final Approvers','',null,null,null,null,'Active','Available','{}'::jsonb,now()),
  ('head_employee_experience_hrbp','Head of Employee Experience & HR Business Partnering','Final Approvers','',null,null,null,null,'Active','Available','{}'::jsonb,now())
on conflict (id) do update
set role=excluded.role,
    group_name=excluded.group_name,
    updated_at=now();

create or replace function public.guard_expense_approval_transition()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  actor_role text;
  actor_name text;
  actor_email text;
  required_role text;
  selected_email text;
  final_roles text[] := array[
    'Vice Chairperson',
    'Chairperson',
    'Head of Total Rewards & Employee Relations',
    'Head of Talent Acquisition & People Development',
    'Head of Employee Experience & HR Business Partnering'
  ];
begin
  -- Secure approval links run through the token-authorized service-role Edge Function.
  if coalesce(auth.role(),'') = 'service_role' then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select
    public.current_role(),
    coalesce(p.full_name,p.email,''),
    lower(trim(coalesce(p.email,'')))
  into actor_role, actor_name, actor_email
  from public.profiles p
  where p.id=auth.uid();

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status='Draft' and new.status='Pending President Recommendation' then
    return new;
  end if;

  -- President leave route: request goes directly to final approval.
  if old.status='Draft'
     and new.status='Pending Final Approval'
     and lower(coalesce(new.president_availability,''))='on leave' then
    return new;
  end if;

  -- President recommendation remains President-only.
  if old.status='Pending President Recommendation'
     and new.status in ('Pending Final Approval','Rejected') then
    if actor_role <> 'President' then
      raise exception 'Only the President may recommend or reject at the President stage';
    end if;
    return new;
  end if;

  -- Final approval is tied to the selected Committee approver.
  if old.status='Pending Final Approval'
     and new.status in ('Approved','Rejected') then
    required_role := coalesce(new.final_approver_role,'');
    if not (required_role = any(final_roles)) then
      raise exception 'The selected role is not an eligible final approver role';
    end if;

    selected_email := lower(trim(coalesce(new.final_approver_email,'')));

    if selected_email <> '' then
      if actor_email <> selected_email then
        raise exception 'Only the selected final approver may complete final approval';
      end if;
    elsif coalesce(new.final_approver_name,'') <> ''
          and lower(trim(new.final_approver_name)) <> lower(trim(actor_name)) then
      raise exception 'Only the selected named final approver may complete final approval';
    end if;

    return new;
  end if;

  -- Approved-expense reversal decision remains President-only.
  if old.status='Approved' and new.status='Reversed' then
    if actor_role <> 'President' then
      raise exception 'Only the President may complete an approved-expense reversal';
    end if;
    return new;
  end if;

  if new.status in ('Draft','Cancelled') then
    return new;
  end if;

  raise exception 'This expense status transition is protected by the approval workflow';
end;
$$;

drop trigger if exists trg_guard_expense_approval_transition on public.expense_requests;
create trigger trg_guard_expense_approval_transition
before update of status on public.expense_requests
for each row
execute function public.guard_expense_approval_transition();
