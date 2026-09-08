# Secure No-Login Final Expense Approval

## New flow

President recommends an expense → the app asks the `expense-approval` Edge Function to issue a unique 256-bit token → the request and token expiry are stored in Supabase → the final approver receives:

1. **Secure Review & Final Approval** — no login required.
2. **Open this expense inside UnitedBML** — normal authenticated application view.
3. A **President Recommended Expense Note PDF** attachment.

## Public approval page

The secure page shows:
- Request number/title/event/category/date/purpose
- Requested/prepared by
- All expense lines, quantity, rate, amount and reimbursement flag
- Subtotal, 5% contingency and total
- Budget-overrun details where relevant
- President recommendation, comments and timestamps
- Selected Chairperson/Vice Chairperson
- A downloadable President-stage Expense Note PDF
- Approve / Reject controls

## Security model

The link is possession-based authorization, as requested:
- No user login is required.
- A random 256-bit token is issued by the server.
- Token validity is restricted to one expense.
- Default expiry is 7 days.
- The token is invalidated after the first Approve/Reject decision.
- The request must still be `Pending Final Approval`.
- The Edge Function performs the database action with service-role privileges only after token validation.
- There is no anonymous SELECT/UPDATE policy on `expense_requests`.

**Important:** anyone who receives/obtains the unique URL can act as the selected approver until it expires or is used. Do not forward approval emails.

## Deployment

1. Run `supabase/migrations/009_secure_public_expense_approval.sql`.
2. Deploy `supabase/functions/expense-approval/index.ts`.
3. For `expense-approval`, disable **Verify JWT**. The function manually verifies JWT for the authenticated `issue` action and intentionally permits token-based `view` / `decide`.
4. Redeploy the Netlify application.

The existing `send-email` Edge Function remains required.
