# Server-Issued President Approval Link

This replaces the browser-issued President token architecture.

## Why this fixes the invalid-link problem

Previously:
Browser generates token → browser saves Finance → Supabase sync → email sent → public Edge Function reads token.

A later/stale browser sync could alter the token state.

Now:
Authenticated browser requests `send-president` → the `expense-approval` Edge Function generates a 256-bit token → writes it to the expense row → verifies the returned token → constructs the email from that same in-memory token → calls `send-email`.

The token in the email and the token in Supabase are therefore created by the same server invocation.

## Deployment

1. Run migration `015_server_issued_president_approval.sql`.
2. Redeploy `expense-approval`.
3. Ensure `expense-approval` has Verify JWT OFF.
4. Ensure `send-email` is the version included in this package.
5. Redeploy Vercel.
6. Existing President links are intentionally invalidated. Resend the President approval email/create a new test expense.

Do not test an old President link after migration 015. It is deliberately invalidated.
