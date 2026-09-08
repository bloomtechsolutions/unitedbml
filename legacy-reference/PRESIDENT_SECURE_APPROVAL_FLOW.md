# President Secure Approval Flow

Expense submission now sends a secure no-login email to the active President.

Flow:
1. Expense is submitted.
2. UnitedBML saves it as Pending President Recommendation.
3. A separate 256-bit President token is created and saved with a 7-day expiry.
4. The President receives the expense details and a Secure Review & Recommend link.
5. President can Recommend & Continue or Reject without signing in.
6. Recommend moves the request to Pending Final Approval, consumes the President token, creates a new final-approver token, and the server automatically sends the final-approver email.
7. Final approver uses the existing secure link to Approve or Reject.

The President and final approver have different one-time tokens. Neither expense table is exposed anonymously.

Deployment:
- Run 013_president_secure_email_approval.sql.
- Redeploy expense-approval Edge Function.
- Redeploy send-email Edge Function.
- Keep Verify JWT OFF for both functions because both functions perform their own authorization/token validation. send-email still requires either a valid user bearer token or the internal Supabase service key.
- Redeploy Vercel.
- Ensure the active President and final approver have email addresses in Committee Management.
