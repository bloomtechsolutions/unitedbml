# UnitedBML V12.9.10 AP Attachment Modes

## Procurement response evidence
For Standard Procurement-approved reimbursements, the Procurement response
attachment recorded during the Procurement approval stage is automatically
included in every AP submission for the resulting line-wise reimbursement case.

The AP package therefore includes:
1. Approved Expense Approval Note
2. Procurement Response / Approval evidence
3. Bills attachment(s)

## Bill attachment modes

### Combined Bills
Use one combined PDF/image for all bills in the AP batch.

### Individual Bills
Attach one PDF/image against each bill row.

Every individual bill must have an attachment before the AP email can be sent.

## Storage
New bill attachments are stored in the existing private Supabase Storage bucket:
`reimbursement-evidence`

Paths use:
`ap-bills/<reimbursement>/<batch>/<bill>/...`

Older AP drafts that used browser IndexedDB combined attachments remain
supported as a backward-compatible fallback.

## Tracking
Reimbursement and AP accounting remain line-wise. The attachment choice affects
only how supporting bill documents are packaged and retained.

## Deployment
V12.9.10 expects the V12.9.9 storage migration
`031_procurement_response_evidence_storage.sql`
to have been run.

No additional SQL migration is required.
