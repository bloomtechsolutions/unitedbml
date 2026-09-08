# UnitedBML Finance Fix

This patch fixes the Finance module failure where **New Expense Request** did not open.

## Root causes corrected

1. `canCreateExpenseRequest()` was referenced by the Finance buttons but was missing from the rebuilt HTML.
2. `canRequestReversal()` and `canRecommendExpense()` were also missing and would break later approval/reversal stages.
3. Auth profile roles such as `treasurer` were compared case-sensitively against `Treasurer`, causing authorized users to fail permission checks.
4. The expense form was still generating dummy Chairperson/Vice Chairperson options when real committee members were not assigned. Dummy final approvers have been removed.
5. Final approval permission now also verifies that the request is actually at `Pending Final Approval` status.

## Deploy

1. Run `supabase/migrations/002_finance_role_fix.sql` in Supabase SQL Editor. This is non-destructive.
2. Deploy this folder/ZIP to Netlify.
3. Sign out and sign back in so the normalized profile role reloads.
4. Finance > New Expense Request should open for Treasurer, Secretary, Male Coordinator 1 and Male Coordinator 2.
5. Make sure an active Chairperson or Vice Chairperson is assigned under Committee before submitting an expense.
