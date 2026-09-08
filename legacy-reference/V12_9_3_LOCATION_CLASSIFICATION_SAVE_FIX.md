# UnitedBML V12.9.3 Location Classification Save Fix

The Location Classification form previously failed with:

`there is no unique or exclusion constraint matching the ON CONFLICT specification`

Cause:
- V12.9.2 had a unique expression index on `(match_type, lower(match_value))`.
- Supabase/PostgREST upsert used `onConflict: match_type,match_value`.
- PostgREST requires a matching real unique constraint.

V12.9.3:
1. adds `UNIQUE(match_type, match_value)`,
2. keeps the case-insensitive expression index,
3. changes the frontend/backend save path to update an existing record by ID
   or existing Unit/Department match before inserting a new row.

For an already deployed V12.9.2 database, run:

`supabase/migrations/028a_staff_location_unique_constraint_fix.sql`

Then deploy the V12.9.3 package.
