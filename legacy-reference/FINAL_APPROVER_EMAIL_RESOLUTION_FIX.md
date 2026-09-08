# Final Approver Email Resolution Fix

## Root cause
For the normal President -> Final Approver workflow, the expense request did not
copy the selected final approver email into `expense_requests.final_approver_email`.
After President recommendation, the Edge Function checked only that blank field
and incorrectly reported that the email was not configured.

## Fixed behavior
- New expense submissions always persist the selected final approver's Committee email.
- After President recommendation, the Edge Function resolves the final approver fresh from active `committee_members` using:
  1. exact selected name + role
  2. exact selected name
  3. selected role
  4. profile email fallback where available
- The resolved email/name/role is saved back into the expense request.
- Existing requests can be repaired with migration 016.

## Deployment
1. Run `016_final_approver_email_repair.sql`.
2. Redeploy the `expense-approval` Edge Function.
3. Redeploy Vercel.
4. For EXP-2026-005, the President recommendation is already complete and its President link is closed. After migration 016, use the app's final-approval retry/send action, or create a new test request to verify the complete automatic chain.
