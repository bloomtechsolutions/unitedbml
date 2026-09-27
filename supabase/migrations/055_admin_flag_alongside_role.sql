-- UnitedBML: let a user hold Administrator access ALONGSIDE their committee-position role
-- (e.g. a Secretary who should also get Administrator privileges) — profiles.role is a single
-- string that already doubles as the person's committee position label used everywhere (email
-- signatures, PDFs, is_committee_user()), so it can't just be overwritten to 'Administrator'
-- without losing that. A separate flag keeps both.

alter table public.profiles add column if not exists is_administrator boolean not null default false;

create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'Administrator' or is_administrator from public.profiles where id = auth.uid()),
    false
  )
$$;
grant execute on function public.is_administrator() to authenticated;

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
for all to authenticated using (public.is_administrator()) with check (public.is_administrator());
