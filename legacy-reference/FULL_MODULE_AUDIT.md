# UnitedBML Full Application Module Audit

## Dashboard
- Checked dashboard navigation, KPI rendering, activity calendar and module shortcuts.
- Event rendering now avoids write attempts for read-only Staff Member accounts, preventing DB sync errors simply from opening the dashboard.

## Events & Activities
- Checked event create/edit, event types, assignments, attendance, archive and actual settlement entry.
- Added read-only guards for Staff Member accounts so UI changes cannot remain only in browser state when RLS rejects them.
- Attendance import/update actions are guarded consistently.

## Meetings
- Checked meeting create/edit, agenda, attendance, decisions, actions, minutes and cancellation flows.
- Added module-level role guards to avoid browser-only edits by read-only users.

## Committee
- Checked assign/edit/clear flows and President availability.
- Committee mutations now require an authorized management role.

## Finance
- Critical fix: renderFinance() no longer saves data as a side effect.
- Expense draft, submission, approval, rejection, reversal and budget changes now save explicitly.
- Approval/reversal forms re-check the signed-in user's authority at submit time.
- Final approval token is synchronized to Supabase before the email is sent.

## Reimbursements / Procurement
- Procurement case is flushed to Supabase before Gmail sends the pre-approval email.
- Procurement response submission re-checks Treasurer permission.
- Reimbursement actuals remain driven by Paid AP batches only.

## Accounts Payable
- AP Draft is persisted to Supabase before the email is sent.
- After Gmail succeeds, Sent-to-AP status is persisted and flushed before the modal closes.
- AP status submission re-checks Treasurer permission.
- Draft, Submitted and Paid accounting states remain separated.

## Email Edge Function
- Added health-check mode that does not send an email.
- Errors now identify the failing stage: authentication, Gmail token, MIME, Gmail send or audit log.
- Critical fix: a successful Gmail send is no longer reported as failed just because `email_log` insert failed. This prevents duplicate resend attempts.
- Migration 007 guarantees current email-log columns exist.

## Placeholder navigation modules
Tournaments, Communication, Polls & Voting, Recognition, Documents, global Reports and Settings are still placeholder navigation entries in this HTML build. They do not have complete functional modules yet and were not falsely treated as operational modules.
