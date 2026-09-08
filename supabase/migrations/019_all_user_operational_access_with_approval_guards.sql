-- UnitedBML operational continuity model
-- All ACTIVE authenticated users can perform operational work.
-- Expense approval transitions remain protected:
--   President recommendation -> President only
--   Final approval -> selected Vice Chairperson / Chairperson only
--   Reversal decision -> President only
--
-- Profiles role administration is intentionally NOT opened because allowing every
-- user to edit roles would defeat the approval controls.

create or replace function public.is_active_authenticated_user()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.status,'Active')) <> 'inactive'
  );
$$;

grant execute on function public.is_active_authenticated_user() to authenticated;

-- Replace committee-only operational policies with active-authenticated policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_settings','event_types','budgets','committee_members','committee_leave_history','staff',
    'events','event_tasks','event_task_history','event_attendance','event_actual_expenses',
    'meetings','meeting_attendees','meeting_agenda','meeting_decisions','meeting_actions','meeting_action_history',
    'expense_requests','expense_lines','expense_approvals','expense_reversals',
    'reimbursement_cases','reimbursement_history','ap_batches','ap_bills',
    'attachments','email_log','audit_log'
  ]
  loop
    execute format('drop policy if exists auth_read on public.%I',t);
    execute format('drop policy if exists committee_read on public.%I',t);
    execute format('drop policy if exists committee_write on public.%I',t);
    execute format('drop policy if exists active_user_read on public.%I',t);
    execute format('drop policy if exists active_user_write on public.%I',t);

    execute format(
      'create policy active_user_read on public.%I for select to authenticated using (public.is_active_authenticated_user())',
      t
    );
    execute format(
      'create policy active_user_write on public.%I for all to authenticated using (public.is_active_authenticated_user()) with check (public.is_active_authenticated_user())',
      t
    );
  end loop;
end $$;

-- Vendor master is operational too.
drop policy if exists vendor_master_read_authenticated on public.vendor_master;
drop policy if exists vendor_master_manage_authorized on public.vendor_master;
drop policy if exists vendor_master_insert_authorized on public.vendor_master;
drop policy if exists vendor_master_update_authorized on public.vendor_master;
drop policy if exists vendor_master_delete_authorized on public.vendor_master;
drop policy if exists vendor_master_active_read on public.vendor_master;
drop policy if exists vendor_master_active_write on public.vendor_master;

create policy vendor_master_active_read
on public.vendor_master for select to authenticated
using (public.is_active_authenticated_user());

create policy vendor_master_active_write
on public.vendor_master for all to authenticated
using (public.is_active_authenticated_user())
with check (public.is_active_authenticated_user());

-- Approval transition guard.
create or replace function public.guard_expense_approval_transition()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  actor_role text;
  actor_name text;
  required_role text;
begin
  -- Edge Functions / secure approval links use service_role and are already
  -- token-authorized by the server function.
  if coalesce(auth.role(),'') = 'service_role' then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select
    public.current_role(),
    coalesce(p.full_name,p.email,'')
  into actor_role, actor_name
  from public.profiles p
  where p.id=auth.uid();

  -- Same-state operational edits are allowed.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Draft/operational submission.
  if old.status='Draft' and new.status='Pending President Recommendation' then
    return new;
  end if;

  -- President-on-leave bypass.
  if old.status='Draft'
     and new.status='Pending Final Approval'
     and lower(coalesce(new.president_availability,''))='on leave' then
    return new;
  end if;

  -- President recommendation or rejection.
  if old.status='Pending President Recommendation'
     and new.status in ('Pending Final Approval','Rejected') then
    if actor_role <> 'President' then
      raise exception 'Only the President may recommend or reject at the President stage';
    end if;
    return new;
  end if;

  -- Final approval / rejection.
  if old.status='Pending Final Approval'
     and new.status in ('Approved','Rejected') then
    required_role := case
      when lower(replace(coalesce(new.final_approver_role,''),'_',' '))='vice chairperson'
        then 'Vice Chairperson'
      when lower(replace(coalesce(new.final_approver_role,''),'_',' '))='chairperson'
        then 'Chairperson'
      else coalesce(new.final_approver_role,'')
    end;

    if actor_role not in ('Vice Chairperson','Chairperson')
       or actor_role <> required_role then
      raise exception 'Only the selected Vice Chairperson or Chairperson may complete final approval';
    end if;

    if coalesce(new.final_approver_name,'') <> ''
       and lower(trim(new.final_approver_name)) <> lower(trim(actor_name)) then
      raise exception 'Only the selected named final approver may complete final approval';
    end if;

    return new;
  end if;

  -- President-only reversal completion.
  if old.status='Approved' and new.status='Reversed' then
    if actor_role <> 'President' then
      raise exception 'Only the President may complete an approved-expense reversal';
    end if;
    return new;
  end if;

  -- Operational statuses such as Cancelled remain open.
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

comment on function public.guard_expense_approval_transition() is
'Allows all active users operational access while preserving President and final-approver decision authority.';
