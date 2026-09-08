# UnitedBML Application Audit Fixes

This build was audited after the branding change.

## Corrected defects

1. **Draft AP batches were counted as Submitted to AP.**
   - Fixed: Draft / Not Started batches are excluded from Submitted-to-AP totals.
   - Drafts still reserve approved reimbursement value to prevent over-submission.

2. **Draft / Sent / Processing AP bills could become Post-Event Actual Expense.**
   - Fixed: reimbursement actual expense now uses only AP batches with status `Paid`.
   - Sent or Processing amounts remain workflow amounts, not accounting actuals.

3. **AP 'Save Bills' behaved like a Send validation.**
   - Fixed: a Draft can now be saved without an AP email or combined attachment.
   - Email + attachment are required only when sending.

4. **AP button wording was misleading.**
   - Changed `Prepare AP Email + Attachments` to `Send AP Email + Attachments`.

5. **Vendor master migration could fail because `public.current_user_role()` did not exist.**
   - Fixed migration 005 to use `profiles + auth.uid()` directly.
   - Added migration 006 as a safe repair for already-running databases.

6. **Reimbursement actual vendor details included unpaid batches.**
   - Fixed: actual vendor rows now come from Paid AP batches only.

7. **Vendor picker inline account handling was reviewed.**
   - Vendor selection remains account-key based and auto-fills account/name/worker ID.

8. **Branding consistency**
   - User-facing branding remains UnitedBML.
   - Existing DOM IDs, localStorage keys and IndexedDB name are intentionally retained for compatibility with existing deployed data/cache.

## Accounting state model

- Draft: reserves approved amount only.
- Sent to AP / Processing: counts as Submitted to AP, but not Actual Expense.
- Paid: counts as Submitted to AP and Post-Event Actual Expense.
- Cancelled: excluded from all totals.
