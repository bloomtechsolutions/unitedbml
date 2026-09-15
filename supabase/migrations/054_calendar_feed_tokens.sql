-- UnitedBML: per-user secret tokens for the Outlook/Google Calendar subscription feed
-- (src/app/api/meetings-feed/route.ts). Kept in their own table — not on profiles, whose
-- profiles_read policy is `using (true)` and would otherwise leak every user's token to
-- every other authenticated user.

create table public.calendar_feed_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

alter table public.calendar_feed_tokens enable row level security;
drop policy if exists calendar_feed_tokens_own on public.calendar_feed_tokens;
create policy calendar_feed_tokens_own on public.calendar_feed_tokens
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
