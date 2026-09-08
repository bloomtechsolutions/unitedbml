# expense-approval Edge Function

Provides secure token-based final expense approval.

Actions:
- `issue` — authenticated; creates/reuses a 7-day one-time token.
- `view` — public token validation; returns only the target expense review data.
- `decide` — public token validation; records Approve/Reject and invalidates the token.

This function must be deployed with JWT verification disabled because `view` and `decide` are intentionally public-token endpoints. The function itself requires and verifies a JWT only for `issue`.

The Supabase service role key is available to Edge Functions automatically as `SUPABASE_SERVICE_ROLE_KEY`.
