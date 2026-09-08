# UnitedBML V12.10.6 Tournament Department Resolution

## Root cause
Tournament registrations copied Department from the legacy `staff.data` JSON.
The current Staff Master stores Department in the normalized `staff.department`
column. Registrations created from staff records without the old JSON value were
saved with a blank Department.

The original Tournament stats RPC converted blank Department to `Unspecified`.

## Fix
- future self/team registrations use normalized Staff Master Department
- existing blank Tournament registrations are backfilled from Staff Master
- Tournament stats dynamically resolve Department from Staff Master by UID first,
  then email
- historical registration Department is retained as fallback
- the vague `Unspecified` label is replaced with `Staff Master Missing Department`
  only when a participant genuinely cannot be resolved
- Committee users see an actionable warning telling them to correct Staff Master

## Deployment
Run:
`supabase/migrations/033_tournament_department_resolution.sql`

Then deploy V12.10.6 to Vercel.
