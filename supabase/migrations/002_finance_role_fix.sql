-- ClubSphere finance permission / role normalization patch
-- Safe to run on an existing database. Does not delete application data.

update public.profiles
set role = case lower(trim(replace(replace(role, '_', ' '), '-', ' ')))
  when 'administrator' then 'Administrator'
  when 'admin' then 'Administrator'
  when 'chairperson' then 'Chairperson'
  when 'chair person' then 'Chairperson'
  when 'vice chairperson' then 'Vice Chairperson'
  when 'vice chair person' then 'Vice Chairperson'
  when 'president' then 'President'
  when 'treasurer' then 'Treasurer'
  when 'secretary' then 'Secretary'
  when 'male coordinator 1' then 'Male Coordinator 1'
  when 'male coordinator 2' then 'Male Coordinator 2'
  when 'communications coordinator' then 'Communications Coordinator'
  when 'communication coordinator' then 'Communications Coordinator'
  when 'atoll coordinator' then 'Atoll Coordinator'
  when 'atoll representative' then 'Atoll Representative'
  when 'staff member' then 'Staff Member'
  when 'staff' then 'Staff Member'
  else role
end,
updated_at = now();

-- Make policy-side role comparisons resilient to legacy lowercase/underscore values.
create or replace function public.current_role() returns text
language sql stable security definer set search_path=public as $$
  select case lower(trim(replace(replace(coalesce((select role from public.profiles where id=auth.uid()),'Staff Member'), '_', ' '), '-', ' ')))
    when 'administrator' then 'Administrator'
    when 'admin' then 'Administrator'
    when 'chairperson' then 'Chairperson'
    when 'chair person' then 'Chairperson'
    when 'vice chairperson' then 'Vice Chairperson'
    when 'vice chair person' then 'Vice Chairperson'
    when 'president' then 'President'
    when 'treasurer' then 'Treasurer'
    when 'secretary' then 'Secretary'
    when 'male coordinator 1' then 'Male Coordinator 1'
    when 'male coordinator 2' then 'Male Coordinator 2'
    when 'communications coordinator' then 'Communications Coordinator'
    when 'communication coordinator' then 'Communications Coordinator'
    when 'atoll coordinator' then 'Atoll Coordinator'
    when 'atoll representative' then 'Atoll Representative'
    when 'staff member' then 'Staff Member'
    when 'staff' then 'Staff Member'
    else coalesce((select role from public.profiles where id=auth.uid()),'Staff Member')
  end
$$;

-- Verify roles after patch.
select id,email,full_name,role,committee_slot,status
from public.profiles
order by email;
