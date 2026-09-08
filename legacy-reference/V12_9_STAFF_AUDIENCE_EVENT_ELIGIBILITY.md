# UnitedBML V12.9 Staff Audience & Event Eligibility

## Architecture
Event is the eligibility authority.

Every Event has one mandatory audience:
- All Staff
- Malé Based
- Atoll Based

Staff are not manually tagged one by one. Their category is derived from:

Staff UID / email → Staff master → Department → Department Audience Mapping

## Administrator
A new **Staff Classification** workspace is available to the Administrator.

It automatically discovers Departments from the Staff master and shows:
- Malé Based staff count
- Atoll Based staff count
- Unclassified staff count
- total Departments

Administrator maps each Department to:
- Malé Based
- Atoll Based

Optional metadata:
- Branch / Unit
- Atoll
- Notes

Unmapped Departments remain `UNCLASSIFIED`; the application never guesses.

## Event creation
`Eligible Staff` is now mandatory:
- All Staff
- Malé Based
- Atoll Based

This value is saved as `events.audience_type`.

## Participant Portal
The default Activities filter is **Available for Me**.
A user can switch to **All Activities** to see other UnitedBML events, but an
ineligible event is visibly locked and has no Register/Create Team/Join Team action.

## Server-side enforcement
Supabase validates eligibility for:
- Individual Event registration
- Event Team creation
- Event Team join request
- Event Team leader approval
- Tournament registration INSERT
- Tournament Team creation
- Tournament Team leader approval

Linked Tournaments inherit eligibility from `tournaments.event_id`.

Even if a user changes frontend code, directly calls Supabase, or scans a Team QR,
an ineligible registration is rejected by the database.

## All Staff
All Staff events are available to every active authenticated staff user, including
users whose Department has not yet been classified.

## Unclassified
For Malé Based or Atoll Based events, unclassified staff receive:
`Your staff location classification has not yet been configured. Please contact UnitedBML.`

## External Event Officials
External Event Official / Team Manager authorization remains Event-specific and
separate from participant eligibility. Their reimbursement authorization is not
removed by this classification model.

## Deployment
Run:
`supabase/migrations/027_staff_audience_event_eligibility.sql`

Then deploy the V12.9 package to Vercel.

No new Edge Function or Cron job is required.
