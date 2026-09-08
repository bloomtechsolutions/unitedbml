# Secure Approval Email Pipeline Fix

## Root cause of "no email sent"

The prior build made the final approval email depend on the new `expense-approval`
Edge Function successfully completing its `issue` action before the application
could call the already-working `send-email` function. If the new function was not
deployed, JWT settings were wrong, or its authorization check failed, the email
pipeline stopped before Gmail was called.

## Corrected sequence

1. President recommends.
2. Expense status becomes `Pending Final Approval`.
3. UnitedBML generates a cryptographically random secure token in the authenticated session.
4. A 7-day expiry is stored with the token.
5. `saveFinance()` + `flush()` persist the token to Supabase.
6. UnitedBML reads the exact row back from Supabase and verifies:
   - status is `Pending Final Approval`
   - token matches
   - expiry exists
   - token has not been used
7. The President-stage Expense Approval Note PDF is generated.
8. The existing `send-email` Edge Function sends Gmail.
9. Gmail message ID and send status are saved back to Supabase.

The `expense-approval` Edge Function is now used only when the recipient opens
or acts on the no-login secure link. It can no longer block email generation.

## Deployment

1. Run `supabase/migrations/010_secure_approval_email_pipeline_fix.sql`.
2. Keep/deploy the `expense-approval` Edge Function for secure no-login approval.
3. Keep `Verify JWT` OFF for `expense-approval`.
4. Keep the existing working `send-email` Edge Function.
5. Redeploy the Netlify app.
