# UnitedBML V12.10.2 AP Status Update

## AP Submission Register
Each AP batch now has an **Update Status** button.

The status form records:
- AP Status
- Status Date
- Status Remarks
- Updated By
- Updated At

Supported statuses:
- Sent to AP
- Processing
- Returned / Query
- Paid
- Cancelled

`Returned / Query` requires remarks.

## Audit
Every status change is appended to:
- AP batch history
- linked reimbursement history

The modal displays recent AP status history.

## Financial effect
Existing calculations continue to use AP batch status:
- Draft and Cancelled are excluded from submitted totals
- Sent to AP / Processing / Returned / Query remain submitted
- Paid contributes to paid actuals

## Database
No new migration is required because `ap_batches` already contains:
- `status`
- `status_date`
- `status_remarks`
- `data`

The existing Supabase synchronization already persists these fields.
