# UnitedBML V12.10 Documents Module

## Core views
- Overview
- Events
- Approved Notes
- Procurement
- Bills & Receipts
- AP Submissions

## Automatic document linking
The module does not copy existing Finance files.

It builds a virtual document index from:
- approved Expense Requests
- grouped Procurement pre-approvals
- Procurement response evidence
- reimbursement line cases
- AP batches
- combined bills
- individual bills

One stored file can therefore appear under both its functional category and its
Event folder without creating duplicate storage objects.

## Event folders
Every Event can act as a smart folder. Documents are grouped within it as:
- Approved Notes
- Procurement
- Bills & Receipts
- AP Submissions
- Event Documents
- Tournament / Results
- Meeting / Governance
- General / Shared

## Approved Notes
Approved Expense Approval Notes are generated on demand from the approved
Expense Request. They are not uploaded as duplicate PDFs.

## Manual documents
Committee members can upload supporting/general documents up to 25 MB.
These are stored privately in:
`unitedbml-documents`

Metadata is stored in:
`public.document_registry`

## Procurement / Bills
Existing files remain in:
`reimbursement-evidence`

The Documents module uses signed URLs to open them securely.

## Deployment
Run:
`supabase/migrations/032_documents_module.sql`

Then deploy V12.10 to Vercel.

No new Edge Function or Cron job is required.
