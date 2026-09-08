# UnitedBML V12.10.8 Contingency Request Limit Guard

## Issue
The amount field allowed users to type values far above the visible available
contingency. The submit handler rejected the value later, but the UI gave the
impression that the amount was valid.

There was also a concurrency risk: multiple pending contingency requests could
each be entered against the same remaining reserve.

## UI controls
- Additional Amount Required receives a dynamic HTML `max`
- maximum equals the contingency currently available for a new request
- oversized values turn the field red
- Submit to President is disabled
- the exact maximum and excess amount are displayed
- `Use Full Available` fills the maximum valid amount
- preview no longer displays an impossible adjusted ceiling

## Reservation logic
Pending requests now reserve contingency while they are active.

Reserved statuses:
- Pending President Recommendation
- Pending Procurement Pre-Approval
- Awaiting Procurement Response

Approved/released amounts are also deducted.

Rejected/cancelled requests do not consume the reserve.

## Database guard
Migration 035 adds a trigger that:
- reads the approved contingency directly from `expense_requests.contingency_amount`
- ignores browser-supplied availability as a source of truth
- locks the Expense Request row during validation
- totals all active/pending/released contingency commitments
- rejects any insert/update that would exceed the approved reserve
- prevents `released_amount` exceeding `requested_amount`

This protects against simultaneous users and direct API/database writes.

## Deployment
Run:

`supabase/migrations/035_contingency_request_limit_guard.sql`

Then deploy V12.10.8 to Vercel.
