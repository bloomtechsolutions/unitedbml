# UnitedBML V12.10.1 Login Recovery Fix

## Problem
The previous bootstrap treated these as one operation:

1. Supabase authentication
2. profile loading
3. loading every operational table

If any operational table/query failed, the catch handler reopened the login
overlay. A successful authentication could therefore look like a failed login.

## Fix
Authentication/profile validation is now the access gate.

Operational hydration runs separately. If an operational query fails:
- the authenticated user is still allowed into Management HUB
- the DB badge reports a sync warning
- the exact operational error is shown
- the browser console records the hydration error
- modules that can work continue working

Actual authentication/profile failures still block access.

Additional fixes:
- Sign In button is re-enabled after a failed credential attempt.
- Empty email/password is handled cleanly.
- Documents form startup listener is DOM-safe.
- navigation is protected against missing section IDs.

This build still includes the V12.10 Documents module.
No SQL migration is required beyond migration 032 for Documents.
