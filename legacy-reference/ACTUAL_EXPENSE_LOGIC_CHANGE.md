# Post-Event Actual Expense Logic Change

## New accounting flow

### Reimbursement-required expense line
Finance approval -> Reimbursements -> Procurement/AP -> Event Actuals

- The Treasurer does not manually enter the actual amount again.
- UnitedBML matches the reimbursement case by `expense_request_id + line_index`.
- Actual amount is the total of non-cancelled AP bill rows for that reimbursement line.
- Vendor/AP details are displayed read-only in Post-Event Actuals.
- Finance cannot be closed while a reimbursement line is still financially unsettled.
- A rejected reimbursement is treated as settled at actual MVR 0.

### Non-reimbursement expense line
Finance approval -> Treasurer Post-Event Actuals

- Treasurer enters only the final Actual Amount.
- Vendor ID and Vendor Name are not required.
- No Excel export/upload is required.

### 5% contingency
- Remains part of the approved budget.
- Is displayed as a budget reserve.
- Actual amount is MVR 0 because contingency is not itself an expense line.

## Automatic synchronization
Whenever a reimbursement/AP record is saved or its AP status changes, UnitedBML refreshes the linked event actual lines and persists the event back to Supabase.

## Supabase
Run `supabase/migrations/004_actual_expense_source_logic.sql` before deploying this build.
