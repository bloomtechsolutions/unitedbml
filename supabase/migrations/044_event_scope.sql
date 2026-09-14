-- UnitedBML: replace the unused Audience picker on the Event form with a simple
-- Internal/External scope — Internal for events UnitedBML runs itself, External for events run
-- by someone else that UnitedBML staff participate in (e.g. an external futsal tournament).

alter table public.events
  add column if not exists event_scope text not null default 'Internal';
