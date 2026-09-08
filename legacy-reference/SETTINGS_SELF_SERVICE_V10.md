# UnitedBML Settings - Self Service

The Settings navigation item is now a real account-management module.

## Current user can change
- Display name
- Member / Staff ID
- Contact number
- Profile photo URL
- Password
- Sign out other sessions
- Sign out current session

## Protected fields
The user cannot self-edit:
- Authentication email
- UnitedBML role
- Account status
- Committee approval authority

This is intentional because those fields affect authentication and finance approval controls.

## Password security
Changing the password requires:
1. current password
2. new password
3. confirmation of the new password

The app re-authenticates the current user before calling Supabase Auth `updateUser`.

## Database
Run migration:

`supabase/migrations/021_self_service_account_settings.sql`

It adds `profiles.avatar_url` and a security-definer RPC named `update_my_profile`.
The RPC updates only safe self-service fields and does not expose role/status/email changes.

## Deployment
1. Run migration 021.
2. Redeploy the Vercel package.
3. No Edge Function deployment is required.
