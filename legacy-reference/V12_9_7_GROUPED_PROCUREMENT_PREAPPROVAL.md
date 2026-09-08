# UnitedBML V12.9.7 Grouped Procurement Pre-Approval

## New model

### Procurement approval
One approved Expense Request produces one grouped Procurement pre-approval.

Example:
EXP-2026-001
- Jersey (Players)
- Jersey (Official)
- Water
- Refreshment
- First Aid Kit
- External Player

These are sent to Procurement in one email with one approved Expense Approval Note.

### Reimbursement tracking
After Procurement approval, UnitedBML automatically creates one reimbursement
case for each expense line.

Example:
RPA-2026-001-01 — Jersey (Players)
RPA-2026-001-02 — Jersey (Official)
RPA-2026-001-03 — Water

Each case has its own:
- approved line amount
- remaining amount
- AP batches
- bills
- AP status
- paid status

This retains line-level financial tracking while eliminating duplicate
Procurement approval emails.

## Email template
The grouped email now uses:

Dear Sir,

Please review the following reimbursement pre-approval request.

Expense Request
Event / Activity
Expense Items table
Amount
Reason for reimbursement

If there is more than one expense item OR total amount exceeds MVR 10,000:
"Please note that any single reimbursement will not exceed MVR10,000."

Placed for your approval to proceed.

Attachment: Approved Expense Approval Note

Regards,
Signed-in UnitedBML user's name, role and email where available.

## Exceptions
No Pre-Approval / Exception remains line-wise because the exception belongs to a
specific reimbursement expense line.

## Database
No new database migration is required. The grouped Procurement approval is
stored in the existing reimbursement structure and child reimbursement cases are
created on approval.
