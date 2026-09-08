# Expense Lines Repair

## Root cause
Generic Finance synchronization replaced `expense_lines` for every request on every Finance save. If the browser held a header record without a populated `lines` array, the child rows could be replaced with an empty set.

That is why the same line items disappeared from:
- Expense Request detail
- Expense Approval Note
- Secure approval page
- PDF note
- Final approval email

## Fix
- Generic Finance saves no longer delete `expense_lines` when the local line array is missing/empty.
- Hydration prefers normalized `expense_lines`, with fallback to `expense_requests.data.lines`.
- Single-expense refresh now fetches both header and child lines.
- Secure approval Edge Function falls back to the compatibility snapshot if child rows are missing.
- Existing records can be repaired using migration `012_expense_lines_repair.sql` where the old JSON snapshot still contains the lines.
- Expense Request, Note and PDF now accept both `qty/total` and `quantity/lineTotal` field shapes.

## PDF branding
Both expense-note PDF variants now use a clean red header and no logo image.

## Important
If an already-affected request has lost its lines from BOTH `expense_lines` and the old `expense_requests.data.lines` snapshot, those particular historical lines cannot be reconstructed automatically and must be re-entered from the original request source.
