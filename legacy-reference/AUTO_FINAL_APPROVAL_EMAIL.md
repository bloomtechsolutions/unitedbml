# Automatic Final Approval Email

When the President recommends a Finance expense request, UnitedBML now automatically:

1. Changes the request to `Pending Final Approval`.
2. Resolves the selected Chairperson / Vice Chairperson email from Committee.
3. Generates the secure final approval token/link.
4. Saves and flushes the request to Supabase.
5. Sends the Gmail approval message automatically.
6. Stores sent time, Gmail message ID and automation status.

If Gmail fails, the President recommendation is **not rolled back**. The request remains in Pending Final Approval and the queue displays `Auto Email Failed` with a retry action.

Run `supabase/migrations/008_auto_final_approval_email.sql` before deploying the new build.
