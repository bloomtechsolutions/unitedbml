# Procurement Email + PDF Fix

1. Run `supabase/migrations/003_reimbursement_email_tracking.sql`.
2. Replace/deploy `supabase/functions/send-email/index.ts` as the `send-email` Edge Function.
3. Keep Gmail secrets configured in Supabase.
4. Redeploy this site to Netlify.

The reimbursement action is now **Send Procurement Email + PDF**. It sends a formatted HTML email, a real PDF MIME attachment, and stores the Gmail message ID.
