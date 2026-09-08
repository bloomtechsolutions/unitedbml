# UnitedBML V12.10.9 Contingency Approval & Register

## President notification
Submitting a contingency request now:
1. saves the request as `Pending President Recommendation`
2. identifies the active President from Committee Management
3. uses the President's linked email
4. emails a concise recommendation notification
5. directs the President to Finance → Approvals
6. logs Sent / Failed / Not Available status on the contingency request

A failed email does not lose the request. It remains visible in the President
approval queue and the failure is shown in the audit record.

## Finance → Approvals
A new Contingency Recommendation Queue appears alongside existing approval
workflows.

The President can:
- Review
- Recommend
- Reject

Non-President Committee members can view the queue but cannot perform the
President action.

## Finance → Contingency
New central Contingency Register with:
- Reference
- Event
- Expense Request / Expense Item
- Requested amount
- President recommendation
- President notification email status
- Procurement status
- Released amount
- Overall status
- workflow progress
- context-sensitive actions

Filters:
- Search
- Status
- Event

Summary:
- President Queue
- Procurement Queue
- Awaiting Procurement Response
- Total Released

## Dashboard notification
For the President, each contingency request awaiting recommendation is also
surfaced in the normal UnitedBML notification center / My Dashboard notification
feed.

## Migration
Run:
`supabase/migrations/036_contingency_president_notification.sql`

No new Edge Function is required. The existing `send-email` function is used.
