-- UnitedBML self-service account settings
-- Users may update only their own non-security profile fields.
-- Role, status, email and approval authority remain protected.

alter table public.profiles
  add column if not exists avatar_url text;

create or replace function public.update_my_profile(
  p_full_name text,
  p_member_uid text default null,
  p_contact_no text default null,
  p_avatar_url text default null
)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(coalesce(p_full_name,'')),'') is null then
    raise exception 'Display name is required';
  end if;

  update public.profiles
  set
    full_name=trim(p_full_name),
    member_uid=nullif(trim(coalesce(p_member_uid,'')),''),
    contact_no=nullif(trim(coalesce(p_contact_no,'')),''),
    avatar_url=nullif(trim(coalesce(p_avatar_url,'')),''),
    updated_at=now()
  where id=auth.uid()
  returning * into result;

  if result.id is null then
    raise exception 'UnitedBML profile not found';
  end if;

  return result;
end;
$$;

revoke all on function public.update_my_profile(text,text,text,text) from public;
grant execute on function public.update_my_profile(text,text,text,text) to authenticated;

comment on function public.update_my_profile(text,text,text,text) is
'Self-service update of full_name, member_uid, contact_no and avatar_url only. Role/status/email are not mutable.';
