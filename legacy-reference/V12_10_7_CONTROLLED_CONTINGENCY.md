
# UnitedBML V12.10.7 Controlled Contingency Allocation

## Workflow
1. Request Contingency Use against a specific approved expense line.
2. President Recommendation.
3. Procurement Manager pre-approval by email.
4. Record Procurement response and attach the response email/evidence.
5. On approval, release the requested amount from the contingency reserve to that expense line.

## Accounting logic
The original approved total never increases.

Example:
- Original expense line: MVR 66,666
- Contingency reserve: MVR 3,333.30
- Approved allocation: MVR 3,000

After release:
- Adjusted expense line ceiling: MVR 69,666
- Remaining contingency: MVR 333.30
- Total approved budget: unchanged

## Settlement
The post-event reconciliation displays:
- original approved amount
- contingency added
- adjusted approved amount
- reserve allocated / available

Finance cannot be closed while a contingency request is still in an approval stage.

## Reimbursements / AP
When contingency is released, existing line-wise reimbursement cases have their approved ceiling updated. New reimbursement cases use the adjusted approved line amount.

## Deployment
Run:
`supabase/migrations/034_contingency_controlled_allocation.sql`

V12.9.9 migration 031 must already exist because Procurement response evidence is stored in the existing private `reimbursement-evidence` bucket.
