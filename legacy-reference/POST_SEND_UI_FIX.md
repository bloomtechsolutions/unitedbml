# UnitedBML Post-Send UI Fix

## Root cause
Gmail was successfully accepting Procurement/AP emails. Immediately afterwards,
`renderReimbursements()` also rendered the hidden Reports pane. That pane called
`escapeHtml()`, but only `escapeHtmlEmail()` was defined. The resulting
ReferenceError was caught by the email workflow's outer catch block, making the
UI incorrectly report an email failure after the message had already been sent.

## Fixes
- Added shared `escapeHtml()` helper backed by `escapeHtmlEmail()`.
- Audited every `escapeHtml()` call in the application.
- Added safe post-action rendering.
- Procurement email delivery is no longer reported as failed because of a later UI refresh error.
- AP email delivery is no longer reported as failed because of a later UI refresh error.
- Final Approval email uses the same protected post-send refresh behavior.
- JavaScript syntax checks pass.

## Database
No SQL migration is required for this fix.
