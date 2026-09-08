# UnitedBML Supabase Field Mapping Audit

## Audit result

The original HTML application was treated as the source of truth. Persisted operational data is no longer stored as one generic application-state JSON object. The rebuilt backend maps the application's major entities to normalized Supabase tables and reconstructs the HTML's nested objects from those tables on login/reload.

A `data JSONB` compatibility snapshot is retained on selected parent tables so a future HTML-only field cannot be silently discarded, but normalized columns and child tables are the primary persistence model.

## Mapping matrix

| HTML / workflow area | Supabase table(s) | Notes |
|---|---|---|
| Authenticated user / role | `profiles` | Supabase Auth user ID, name, email and application role |
| App configuration | `app_settings` | Non-operational application configuration |
| Event type configuration | `event_types` | Static type catalogue only |
| Annual club budget | `budgets` | Starts at 0, no dummy budget |
| Committee slots / assignments | `committee_members`, `committee_leave_history` | Role slots are blank by default; member details persist individually |
| Staff registry | `staff` | UID, name, contact and active data |
| Event header / lifecycle | `events` | Dates, venue, type, coordinator, status, lifecycle/readiness, archive/cancel/settlement/source metadata |
| Event tasks | `event_tasks` | Owner, role, due date, priority, status, notes, source links |
| Event task timeline | `event_task_history` | Individual history entries |
| Attendance | `event_attendance` | Event/staff attendance status and attendance metadata |
| Event actuals / vendor settlement | `event_actual_expenses` | Summary and vendor-level actual/approved/variance/reference data |
| Meeting header | `meetings` | Schedule, chair, secretary, purpose, status and finalisation/cancellation metadata |
| Meeting attendance | `meeting_attendees` | Member/attendance data |
| Agenda | `meeting_agenda` | Order, owner, minutes/outcome, event/finance/source/carry-forward links |
| Decisions | `meeting_decisions` | Decision, outcome, owner and event link |
| Meeting actions | `meeting_actions` | Assignee, role, due date, priority, status, remarks and event link |
| Action history | `meeting_action_history` | Individual action timeline/history records |
| Expense request header | `expense_requests` | Request metadata, requester/preparer, event link, workflow stages, approver/email/token, contingency, budget snapshot, overrun and reversal metadata |
| Expense sub-lines | `expense_lines` | Description, vendor number/vendor, quantity/rate/total and reimbursement-required flag |
| President/final approval history | `expense_approvals` | Stage, decision, approver, remarks and timestamp |
| Expense reversal | `expense_reversals` | Request/review decision, reason, actor and timestamps |
| Reimbursement case | `reimbursement_cases` | Procurement route, manager/head emails, request/response/exception/status metadata |
| Reimbursement history | `reimbursement_history` | Case timeline/history |
| AP submission batch | `ap_batches` | Batch status, remarks, email/attachment/status metadata |
| AP bills | `ap_bills` | Bill/vendor/reference/amount/status data |
| Files / attachment metadata | `attachments` | Related entity, file metadata/storage reference |
| Email audit | `email_log` | Sender, recipients, subject, related workflow record and send result |
| General audit | `audit_log` | Application changes / actor trail |
| User notifications | `notifications` | Per-user notifications |

## Legacy field handling

The original HTML contains legacy flattened AP properties such as `apBills`, `apStatus`, `apStatusDate`, `apStatusRemarks` and `apEmailRemarks`. The HTML's migration logic converts these into AP batch structures. The rebuilt backend persists the normalized form in `ap_batches` and `ap_bills` rather than duplicating both representations.

UI-only controls such as search text, selected tabs, modal visibility and temporary filters are intentionally not database fields because they are not business records.

## Sync defects fixed

1. **Empty database hydration:** previously, an empty Supabase query did not overwrite the HTML's seeded/local cached arrays. Now an empty table explicitly hydrates as an empty array and clears stale cached dummy records.
2. **Competing sources of truth:** the previous adapter fired multiple independent asynchronous mirrors from `localStorage`. The rebuild uses one ordered sync queue and treats the database hydration as authoritative at startup.
3. **Update propagation:** existing rows are upserted by stable record IDs. Child collections are replaced/reconciled so edits do not create stale duplicate child rows.
4. **Delete propagation:** records removed in the HTML are removed from the corresponding Supabase table during sync.
5. **Committee editing:** assigning/editing/clearing committee members previously changed memory without invoking persistence. The form now calls `saveCommittee()` before rerendering.
6. **Event deletion:** event deletion now invokes the event save path.
7. **Nested history:** task history, meeting-action history, expense approvals/reversals and reimbursement/AP child records are persisted separately instead of being silently trapped inside parent JSON.
8. **Visible failure state:** database write failures dispatch a `club-sync-status` error and the UI shows a sync-error state rather than pretending the save succeeded.
9. **Write ordering:** linked data is synchronized in dependency order to reduce foreign-key and race-condition failures.
10. **Reload verification:** login/reload reconstructs application objects from normalized tables, providing a practical check that the database, not only browser memory, contains the edit.

## Blank-data state

The rebuilt HTML contains no seeded operational data:

- 0 events
- 0 meetings
- 0 expense requests
- 0 reimbursements
- 0 attendance records
- 0 staff records
- Budget = 0
- Committee positions remain as blank structural role slots only

The SQL migration likewise does not insert operational records. It inserts only static event-type configuration and blank committee-role slots.

## Destructive rebuild warning

`supabase/migrations/001_rebuild_clubsphere.sql` drops and recreates UnitedBML operational tables. This intentionally clears old dummy/test operational data. Supabase Auth users are not dropped, and the migration preserves/rebuilds the application `profiles` table around existing Auth users.

Back up any real operational data before running the migration.
