# Final Approval Stage Sync Fix

## Root causes fixed

1. Secure-link approval updated Supabase but the open UnitedBML browser retained its old Finance object.
2. No realtime subscription existed for `expense_requests`.
3. A stale open browser could later sync `Pending Final Approval` back over the server's `Approved` or `Rejected` status.
4. The secure Edge Function did not explicitly verify the returned database status before reporting success.

## New behavior

- The secure approval Edge Function updates the request and verifies the returned status.
- `expense_requests` is enabled for Supabase Realtime.
- Logged-in UnitedBML sessions subscribe to expense-request updates.
- The local Finance cache and UI update immediately when final approval occurs elsewhere.
- `Open Expense in UnitedBML` refreshes the request from Supabase before opening.
- The sync layer protects server-side final decisions from stale browser overwrite.

## Deployment

1. Run `supabase/migrations/011_final_approval_stage_sync.sql`.
2. Redeploy the updated `expense-approval` Edge Function.
3. Redeploy the Vercel application.
