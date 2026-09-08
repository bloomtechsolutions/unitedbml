# UnitedBML V12.8.3 Team Approval Fix

The live database can contain Tournament team IDs from older schemas where IDs
were UUID, while focused V12 uses text IDs.

The resulting approval error was:

`operator does not exist: text = uuid`

V12.8.3 resolves this by:
- comparing team IDs using `::text`
- providing both text and UUID helper overloads
- rebuilding affected RLS policies with explicit text conversion
- making the approval RPC accept `approve`, `approved`, `reject`, and `rejected`
- changing the frontend to send canonical `approve` / `reject`

Run migration:

`supabase/migrations/025_tournament_team_approval_type_compatibility.sql`

It is designed as a repair migration and can be run after V12.8.2.
