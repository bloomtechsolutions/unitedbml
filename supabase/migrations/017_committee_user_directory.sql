-- UnitedBML Committee user-directory enrichment
-- Adds optional profile fields used to auto-fill Committee assignments.
-- Existing Supabase Auth users and profiles are preserved.

alter table public.profiles
  add column if not exists member_uid text,
  add column if not exists contact_no text,
  add column if not exists committee_term_start date,
  add column if not exists committee_term_end date;

create index if not exists profiles_member_uid_idx
  on public.profiles(member_uid)
  where member_uid is not null;
