# UnitedBML V12.9.5 Committee Self-Service Leave

## Purpose
Active UnitedBML Committee members can set their own leave from **My Settings**.

## Security
The browser does not directly update arbitrary Committee records.

Three Security Definer RPCs resolve the authenticated user against the linked
active Committee assignment using:
1. `committee_members.user_id`
2. Staff UID / `profiles.member_uid`
3. email fallback

The user can update only their own Committee availability.

## Settings
Committee members see a **Committee Leave** card containing:
- Committee position
- Committee group
- Leave From
- Leave To
- current availability
- Save Leave
- Clear Leave / Mark Available

Normal Staff Members do not see this Settings section.

## Effect
Saving leave updates:
- `committee_members.availability = 'On Leave'`
- `leave_from`
- `leave_to`

Clearing leave updates:
- `availability = 'Available'`
- clears both leave dates

The existing Finance President leave routing continues to use these fields, so
a President can schedule leave from their own Settings without requiring an
Administrator to edit Committee Management.

Other Committee availability/approval logic continues to read the same
Committee record.

## Deployment
Run:

`supabase/migrations/030_committee_self_service_leave.sql`

Then deploy V12.9.5 to Vercel.

No new Edge Function or Cron job is required.
