# UnitedBML V12.9.1 Function Signature Fix

V12.9 may stop with:

`ERROR: 42P13: cannot change return type of existing function`

for:

`create_tournament_team(text,text)`

Earlier UnitedBML Tournament versions already created this function with the
same argument signature. PostgreSQL cannot use CREATE OR REPLACE when the
return declaration has changed.

V12.9.1 fixes this by executing:

`DROP FUNCTION IF EXISTS public.create_tournament_team(text,text);`

before recreating the eligibility-aware function.

## What to run

If V12.9 already stopped at this exact error, run:

`supabase/migrations/027a_create_tournament_team_signature_fix.sql`

Then rerun the corrected full:

`supabase/migrations/027_staff_audience_event_eligibility.sql`

The corrected full migration is designed to be safe to rerun and ensures the
remaining V12.9 eligibility changes are applied.
