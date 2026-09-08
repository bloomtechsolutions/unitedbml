# UnitedBML V12.9.9 Procurement Response Evidence

## Response modal
The Procurement response form now contains only:
- Decision
- Response Date
- Approved / Rejected By
- Email Reference / Subject
- Procurement Response Attachment

Removed:
- Procurement Comment
- confirmation checkbox

## Approved / Rejected By
This is read-only and automatically populated from the Procurement email
recipient(s) used when the original pre-approval email was sent.

## Attachment
Supported response evidence:
- Outlook `.msg`
- `.eml`
- PDF
- PNG / JPG

Maximum size: 15 MB.

Files are stored in the private Supabase Storage bucket:
`reimbursement-evidence`

The reimbursement record stores only file metadata/path. A signed URL is
generated when an authorized user opens the response attachment.

## Group approval
When a grouped Procurement request is approved:
- the response attachment remains linked to the grouped approval
- each automatically created line-wise reimbursement case inherits the same
  evidence path and response metadata

This preserves one Procurement response as the approval evidence for all
expense-line reimbursement cases.

## Deployment
1. Run:
   `supabase/migrations/031_procurement_response_evidence_storage.sql`
2. Deploy V12.9.9 to Vercel.

No new Edge Function or Cron job is required.
