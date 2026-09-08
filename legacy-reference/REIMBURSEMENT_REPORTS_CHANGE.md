# Reimbursement Reports

The Reimbursements > Reports tab now supports:

- Event-wise filtering
- Month-wise filtering
- Custom From / To date filtering
- Route filtering (Standard / Exception)
- AP status filtering
- Event-wise roll-up
- Detailed reimbursement register
- CSV export
- Print-ready report

## Report values

- Approved Value: approved reimbursement expense-line amount.
- Submitted to AP: bill values in AP batches that have progressed beyond Draft.
- Paid Actual: bill values in AP batches marked Paid.
- Remaining: Approved Value less Paid Actual.
- Procurement Status: reimbursement/pre-approval case status.
- AP Status: overall status derived from the case's AP batches.

The report reads the existing normalized reimbursement/AP data and does not create a duplicate reporting table.
