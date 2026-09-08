# UnitedBML Management Hub

Modernized rebuild of the UnitedBML club management application: Next.js (App Router) + React +
TypeScript on the frontend, Supabase (Postgres + Auth) on the backend. This replaces the previous
architecture, a single ~12,500-line `index.html` file with vanilla JS DOM rendering (preserved for
reference in `legacy-reference/`), with a component-based, typed codebase migrated module by
module.

Auth state is Supabase-session-based and entirely client-side for now (every route under
`src/app/(protected)/` is a client component gated by `ProtectedLayout`) — there is no
server-rendered/SSR auth via `@supabase/ssr` middleware yet. That would be a good follow-up once
more modules are migrated and page weight starts to matter.

## Status

This is an in-progress rewrite. Modules are migrated one at a time to guarantee each one fully
preserves the original business logic before moving to the next.

| Module | Status |
|---|---|
| Auth, layout shell, navigation | ✅ Migrated |
| Events & Activities | ✅ Migrated (core CRUD, tasks, attendance, lifecycle automation) |
| Committee | ✅ Migrated (roster, assign/vacate, positions & structure admin, club-wide term) |
| Meetings | ✅ Migrated (agenda, attendance, decisions, actions, minutes, agenda→Event creation) |
| Finance | ✅ Migrated (requests, President/Final approval chain, reversals, budget tracking) — Contingency deferred, see below |
| Reimbursements | ✅ Migrated (Procurement pre-approval, exceptions, AP batches/bills, vendor master, status tracking) |
| Tournaments | ✅ Migrated (registration/teams, matches, live screen, results & department stats) — see below for a real DB bug found and worked around |
| Staff Master / Location Classification | ✅ Migrated (roster CRUD, CSV bulk import, unit/department → audience classification) |
| Leaderboard | ✅ Migrated (computed ranking — no dedicated schema, see below) |
| Documents | ✅ Migrated (upload/browse/delete library + read-only Procurement/AP evidence view) |
| Reports | ✅ Migrated (all 15 catalog reports — filters, CSV export, print) |
| Settings | ✅ Migrated (profile self-service, My Committee Leave, password change, session management) |
| Communication | ❌ Removed from scope (product decision — not part of this rewrite) |
| Participant Portal | ✅ Migrated (activities, team self-registration, engagement, External Official reimbursements) |

The legacy `index.html` build (fully functional, all modules) is kept under `legacy-reference/`
purely as a source-of-truth reference while the rest of the modules are ported — it is not served
by this app and can be deleted once migration is complete.

### Known simplifications vs. the legacy build (Events module)

- Event lifecycle automation (`Planning → Ready → Event Day → Post-Event Settlement → Closed`,
  plus the `Cancelled` state) is now ported in full, including the Finance-approval condition —
  `eventLifecycle()`/`eventReadiness()`/`eventLifecycleAlert()` in `src/features/events/lifecycle.ts`
  take a `FinanceStatus` computed by `features/finance/useFinance.ts`'s `useEventFinanceSummary()`
  (a lightweight `expense_requests` query, separate from the full Finance page). Post-event actuals
  reconciliation (`event_actual_expenses`, the "Settlements" screen) is still not migrated — see the
  Finance section below.
- Attendance bulk import from Excel is not yet ported (needs the `xlsx` library wiring). The
  meeting-agenda → event creation linkage *is* now wired (see the Meetings module below), but only
  one-way and simplified: creating an Event from an agenda item pre-fills name/description/
  coordinator and stamps `source_meeting_*`/`source_agenda_*` on the new Event row directly,
  rather than the legacy flow's "switch to Events, open the create form pre-filled, save" UX.
- Writes go straight to Supabase from the browser (no more localStorage-as-source-of-truth +
  debounced sync queue) — this is an intentional architectural simplification enabled by the
  rewrite, not a temporary gap.

### Known simplifications vs. the legacy build (Committee module)

- The org-chart tree diagram is replaced by a flat, filterable roster list plus an admin table for
  setting each position's "Reports To" (`parentId`) and display order — the same data is captured
  (`parentId`/`displayOrder`, stored in `committee_members.data` jsonb same as the legacy build,
  since those were never normalized into columns), just not rendered as a visual tree yet.
- Self-service "My Committee Leave" (the `update_my_committee_leave`/`clear_my_committee_leave`
  RPCs) lives on the legacy Settings page, not the Committee page itself — now ported, see the
  Settings section below.
- `committee_leave_history` has no writer in the legacy app either (dead/unfinished audit-log
  table) — not wired up here, same as upstream.
- The `COMMITTEE_APP_ROLES` client-side role allow-list from the legacy build is replaced by
  calling the `is_committee_user()` RPC directly (exposed as `isCommitteeUser` on `useAuth()`) —
  this removes the risk of the client list drifting from the SQL source of truth, which had
  already happened once in the legacy code (see migration history around `023_*`).

### Known simplifications vs. the legacy build (Meetings module)

- All meeting/agenda/decision/action ids are `crypto.randomUUID()` text values rather than the
  legacy build's composite scheme (`"{meetingId}:A:{itemId}"` etc.) — that scheme existed only to
  make client-generated `Date.now()` ids collision-safe across tables during localStorage→Supabase
  sync, which no longer applies now that writes go straight to Supabase.
  `meeting_attendees`/`meeting_action_history` already had real `uuid` PKs upstream and are
  untouched.
  - `events.id` is the one exception, still a `Date.now()`-based string on creation — see the
    Events module notes above; unchanged here since it's Events' own convention.
- The action↔event-task sync is one-way (meeting action → linked Event task), matching the legacy
  behavior exactly: editing the mirrored task directly on the Event side does not sync back.
- Minutes are print/export via the browser print dialog only (`window.print()` on a generated
  document), same as the legacy build — there's no PDF/Word export library wired up.
- Carry-forward (seeding a new meeting's agenda from other meetings' unresolved actions) is
  included but simplified to a plain checklist in the Schedule Meeting form, rather than the
  legacy's separate "Needs Discussion" agenda-item styling driven by extra `carryForward`/
  `sourceMeetingId` provenance fields (those fields are still written to `meeting_agenda`, just not
  yet rendered with distinct styling).
- No dashboard integration yet (attention items, calendar dots, "next meeting" card) — the
  Dashboard page itself is still a placeholder-level page pending its own migration pass.

### Known simplifications vs. the legacy build (Finance module)

This module is scoped to the **core expense request lifecycle** — creation, President
recommendation, final approval, rejection, cancellation, reversal, and budget-utilization tracking.
Several substantial legacy sub-systems are **deferred, not ported**:

- **Accounts Payable (AP) batches/bills and Reimbursements** are a separate nav module in the
  legacy build (`data-view="reimbursements"`) and out of scope here — Finance only reads
  `expense_requests`/`expense_lines`/`budgets`. See the Reimbursements section below — it's now
  migrated as its own module.
- **Contingency-use requests** (`contingency_requests`, the Procurement pre-approval workflow, the
  President-notification emails) are not implemented. The 5% contingency reserve is computed and
  stored on each request (`contingency_amount`), but there's no UI yet to draw down against it
  per-line.
- **Post-event Settlements/Actuals reconciliation** (`event_actual_expenses`, matching AP bill
  totals back to approved lines) is not implemented — Events' `actual_expense_total` field exists
  in the schema but nothing writes to it yet.
- **The secure, no-login public approval-link flow** (token-issued via the `expense-approval`
  Supabase Edge Function, letting the President/Final Approver decide via an emailed link without
  signing in) is **intentionally not implemented — by product decision, not deferred as a gap.**
  All approval decisions in this rewrite happen in-app, from an authenticated session; every
  approver is expected to log in normally rather than act via an anonymous emailed link. The
  `guard_expense_approval_transition()` DB trigger enforces the same rules either way, so no
  data-integrity behavior is lost — this rewrite simply never adds the public/anonymous route or
  wires the Edge Function's token-based access path. The same decision applies to the legacy
  Participant Portal's External Event Official reimbursement flow — see that section below.
- Approval-stage permission checks in the UI are client-side conveniences (hide/show the
  Recommend/Approve buttons based on `profile.role`/email match) — the real enforcement is the
  `guard_expense_approval_transition()` Postgres trigger (see
  `supabase/migrations/020_extended_final_approvers.sql`), so an unauthorized action fails safely
  server-side even if the client got the gating wrong.
- Expense request/line/approval ids are `crypto.randomUUID()` (or DB defaults), matching the
  Committee/Meetings modules' approach — not the legacy's `Date.now()`-based scheme.

### Known simplifications vs. the legacy build (Reimbursements module)

Covers the full case pipeline: eligible-item discovery, grouped Procurement pre-approval (one
request per Expense Request, fanning out into per-line cases on approval), the Exception route
(bypass Procurement with a recorded reason), AP batch/bill entry with vendor-master typeahead and
Combined/Individual attachment modes, and AP status tracking (Sent to AP → Processing → Paid /
Returned / Cancelled). The legacy build's dead `financeReimbursements` pane (embedded in Finance's
DOM but unreachable — no tab button ever pointed at it, see the legacy `renderReimbursements()`)
was not ported; only the real, reachable `data-view="reimbursements"` module was.

- **No email sending.** The legacy build generates a PDF and sends real emails (Procurement
  pre-approval request, AP batch submission) via the same Gmail Supabase Edge Function used
  elsewhere. This rewrite skips actual email dispatch entirely, consistent with Finance's approval
  emails also being skipped — "Send for Pre-Approval" and "Save & Send to AP" just transition
  status and stamp timestamps/references; a person still has to communicate with Procurement/AP
  through some channel today. Wiring the real Edge Function send is a natural next step, though the
  legacy Communication module that would have shared attachment/PDF tooling here is out of scope
  for this rewrite (product decision — see the Status table above).
- **Single-send protection is simplified** to one re-check of the batch's current status
  immediately before flipping it to `Sent to AP` (blocks a double-click/stale-tab resend). The
  legacy build's three-layer guard (in-memory mutex, a 2-minute stale-lock timestamp for
  crashed sends, and a server-side idempotency key passed to the email provider) doesn't apply
  here since there's no actual async email step to protect against yet — this can be revisited
  once real sending is added.
- **External Event Official self-service reimbursements** (`external_event_reimbursements`, the
  RPCs `submit_external_event_reimbursement`/`decide_external_event_reimbursement`) are submitted
  from the Participant Portal's "My Reimbursements" tab; the Committee approval queue for them is
  ported here as the "External Officials" sub-tab (`external-approval-row` cards, matching legacy's
  `#externalReimbursementApprovalCard`) — see the Participant Portal section below for the
  submission side.
- **Reports tab** (CSV export, print-friendly summary report) is not ported.
- **Event-actuals reconciliation** (`event_actual_expenses`, matching `Paid` AP bill totals back
  onto approved expense lines so Events' post-event settlement shows real actuals) is not wired up
  — same gap already noted under Finance/Events; this module now produces the `Paid` AP data that
  reconciliation would consume, but nothing reads it back yet.
- `reimbursement_cases` intentionally keeps the legacy's dual-shape design (a `data.isProcurementGroup`
  flag distinguishes a pre-split group record from a per-line case) rather than splitting it into
  two tables, to avoid a schema migration — `features/reimbursements/types.ts`'s
  `ProcurementGroupCase` documents the distinction in code instead.

### Known simplifications vs. the legacy build (Tournaments module)

Tournaments are still **auto-provisioned only** — this rewrite has no "create tournament" UI,
matching the legacy build exactly: a DB trigger (`supabase/migrations/022_simple_tournament_module.sql`)
creates a `tournaments` row automatically once an event that looks sports-related (regex over
`event_type`/name, or `events.data->>'isTournament'`) gets an approved expense, or is itself
Approved with no expense. This page only manages tournaments that already exist; there was nothing
to add here.

- **`create_tournament_team()` was a genuinely broken RPC in the legacy migration history — now
  fixed at the source.** Migration `027a` sets its return type to `jsonb`; migration `033`
  originally did `create or replace function public.create_tournament_team(...) returns
  public.tournament_teams` **without a preceding `drop function`**, which Postgres rejects for a
  return-type change (error `42P13`, confirmed live while applying these migrations to a fresh
  project). `033` now starts with `drop function if exists
  public.create_tournament_team(text,text);` before its `create function`, matching the pattern
  `027a` itself already used to fix the same class of problem — a one-line, behavior-preserving fix
  to the migration file itself, not a workaround. This rewrite's client code still sidesteps the
  RPC entirely regardless: team creation goes through two direct inserts (`tournament_teams` then
  `tournament_registrations`), which the existing RLS insert policies already allow for a user
  creating their own team — kept as-is since it works and avoids depending on this RPC at all. See
  `features/tournaments/useTournaments.ts`'s `createTeam()` for the exact reasoning. If the legacy
  app is still deployed somewhere, this bug is worth a real hotfix migration there independent of
  this rewrite.
- **Team-leader reject permission**: migration `026` explicitly makes leaders "approve-only"
  (rejecting requires a non-leader Committee member) — but migration `027` (later) redefines the
  same `approve_tournament_team_request(text,text)` function *without* that restriction, while
  adding an eligibility re-check on approval. Since migrations apply in order, `027`'s version is
  what's actually live, and that's what this rewrite follows: both the team leader and Committee
  can approve or reject. The `026` "approve-only" rule described in earlier research on this module
  is a superseded intent, not the current behavior.
- **No bracket/fixture generator** — matches are entered one at a time by Committee, exactly like
  the legacy build (there was never auto-fixture logic to port).
- **Registration + Teams tabs are merged into one "Registration & Teams" tab** (legacy has them
  separate). Functionally identical, just fewer tabs to click through.
- **Participant Portal self-service for Tournament-linked events is scoped down, not duplicated.**
  Legacy's Portal transparently merges plain-`events` registrations with `tournaments`-table
  registrations so a participant sees one unified list regardless of which table backs a given
  activity. This rewrite's Portal (`src/features/portal/`) only manages the plain `event_teams`/
  `event_registrations` path; for an event with a linked Tournament, participants register from
  this Tournaments page instead (which already has the full self-service flow via
  `createTeam`/`requestJoinTeam`/`selfRegisterIndividual`). Fully unifying the two lists in the
  Portal UI is a reasonable follow-up, not done here to avoid duplicating this page's logic.
- **`tournament_team_messages` (private team chat)** is realtime-capable at the DB level
  (`supabase_realtime` publication includes it) but this rewrite polls on reload rather than
  subscribing to realtime updates — a reasonable follow-up once a broader realtime pattern is
  wanted across the app.

### Known simplifications vs. the legacy build (Staff Master / Location Classification)

Both pages are Administrator-only in the UI (matching the two `adminOnly` nav items already wired
up in `src/components/Layout.tsx` since the initial scaffold) — same as legacy.

- **Bulk import is CSV-only; no `.xlsx` support.** The legacy build's Excel import loads the
  `xlsx` (SheetJS) package from a CDN `&lt;script&gt;` tag. The current npm-published `xlsx@0.18.5` —
  the same version the legacy build pins — has two unpatched high-severity advisories (prototype
  pollution, ReDoS) with "no fix available" on the npm registry; SheetJS only publishes fixes
  through their own CDN now, not npm. Rather than ship a known-vulnerable dependency (even for an
  admin-only upload), this rewrite supports CSV import only, using the same lenient
  header-alias matching (`UID`/`Staff ID`, `Name`/`Full Name`, etc. — see
  `features/staff/csv.ts`) as the legacy Excel/CSV parser. Real-world Excel exports convert to CSV
  trivially; `.xlsx` support can be revisited later against a vetted library (e.g. SheetJS's own
  CDN-hosted patched build, or `exceljs`) if it's actually needed.
- **Added a Status field to the edit form.** The legacy edit modal has no way to deactivate a
  staff member despite `status` being a real column and RPC parameter — a gap the research
  surfaced. This rewrite's `StaffEditModal` exposes Active/Inactive directly.
- **Added a one-click "Missing org data only" filter** on the roster (the legacy build only shows
  a count tile; finding the actual incomplete records means manually working the filters). Small,
  low-risk usability addition matching the spirit of the existing "Missing Org Data" KPI tile.
- **A pre-existing client/DB permission gap is carried over, not fixed.** Both tables' RLS grants
  write access to any Committee-role user (`is_committee_user()`), but the legacy nav — and this
  rewrite's `adminOnly` gate — only *shows* these pages to Administrators. A non-Administrator
  Committee member could still write to `staff`/`staff_location_classification` directly via the
  Supabase client if they knew to. This is unchanged from legacy behavior and is a backend RLS
  decision, not a rewrite regression — flagging it here in case tightening the RLS to
  Administrator-only is ever wanted.
- **The "Unit overrides Department" precedence is computed client-side** for the Location
  Classification page's display (same as legacy's `resolvedAudience()`) rather than calling the
  `staff_audience_for_user()` RPC per staff member, which would mean one RPC call per row. Actual
  eligibility enforcement for event/tournament registration already goes through that RPC via
  `is_staff_eligible_for_event()`/`is_staff_eligible_for_tournament()`, so this page's tiles are a
  display-only preview computed against the same snapshot the table renders from — consistent
  with, not a regression from, the legacy build's own (already duplicated) approach.

### Known simplifications vs. the legacy build (Leaderboard module)

There is no dedicated leaderboard/points table in either build — this is purely a computed
ranking over data already owned by Events and Tournaments, recalculated on every load. Same
scoring weights as legacy (`features/leaderboard/compute.ts`): +3 for event attendance (once per
person per event), +2 per completed event task, +3 for an approved tournament registration, +10
for a 1st-place/"winner" tournament result, +5 for any other placement. Same level thresholds
(Starter/Bronze/Silver/Gold at 0/15/40/75 points) and the same Overall/Events/Tournaments/Delivery
view tabs with a podium + expandable ranking list.

- **Meetings and Committee activity are intentionally excluded from scoring**, exactly as in the
  legacy build — despite the page's own subtitle implying broader "engagement," the legacy
  `unitedBMLLeaderboardRows()` only ever reads event/tournament data. Not a rewrite gap; carried
  over faithfully. Worth a product decision later if broader scoring is wanted.
- **Event attendance credit requires `attended = true`**, not just being on the roster. The legacy
  code's exact filter on its in-memory `attendance[]` array is ambiguous (the research couldn't
  confirm whether it required a "Present" mark or credited anyone listed), so this rewrite makes
  the more defensible call: an explicit "attended" mark, not just being invited/expected. Flagged
  here as an interpretation, not a fully verified port.
- **No date/period scoping** — a lifetime cumulative total, same as legacy (not per committee term,
  not per year). Recomputed from every event/tournament row currently in the database each time
  the page loads, same no-caching approach as legacy (acceptable at current data volumes; worth
  revisiting — e.g. a materialized view or RPC — if the tables grow large).
- **Row identity resolution** (matching event attendance / tournament registration / task-owner
  records to one person) prefers staff UID, then email, then a lowercased name — the same fragile
  fallback chain legacy uses, explicitly flagged in research as worth hardening later (e.g. always
  resolving through Staff Master's UID rather than trusting free-text names on event tasks, which
  have no UID field at all in either schema).

### Known simplifications vs. the legacy build (Documents module)

Legacy's Documents section is really two things: a small manual upload registry
(`document_registry` table + a dedicated `unitedbml-documents` Storage bucket, from migration
`032_documents_module.sql`), and a much larger "virtual aggregation" layer that pulls in read-only
records from Finance/Reimbursements/AP without copying their files. This rewrite ports the manual
registry in full and a scoped-down version of the aggregation:

- **Manual document library**: upload (title, category, optional Event link, notes, 25 MB cap
  enforced both client- and Storage-bucket-side), search/filter, per-event folder view, open via a
  15-minute signed URL, delete (Committee-only both ways, matching the `is_committee_user()` RLS on
  both the table and the bucket). Same rollback-safety as legacy: a failed DB insert after a
  successful upload removes the orphaned Storage object.
- **Linked evidence tab**: surfaces Procurement pre-approval response evidence and AP bill
  attachments already stored by the Reimbursements module (reading `reimbursement_cases.data`,
  `ap_batches.bills_attachment_path`, `ap_bills.data`) via the same `reimbursement-evidence` bucket
  — read-only, not copied, exactly matching legacy's approach of never duplicating another
  module's storage objects.
- **Not ported**: "Approved Notes" (legacy generates an Expense-Approval-Note PDF on demand from
  Finance data using jsPDF — this rewrite has no PDF-generation library wired up yet; opening an
  approved request's detail already works from the Finance page itself), the Meetings/Governance
  and Tournament-Results virtual categories (Meetings/Tournaments have no stored *files* to surface
  here — those modules' own pages are the source of truth for that data), and the legacy IndexedDB
  fallback path for pre-Storage-migration bill attachments (irrelevant for a fresh deployment).
- The `visibility` column on `document_registry` is carried over in the schema but, same as legacy,
  is written on insert and never read/enforced — every document is Committee-visible via RLS
  regardless of its value.

### Known simplifications vs. the legacy build (Reports module)

Like Documents, there is no dedicated schema — the legacy Reports Hub is a pure client-side
aggregation layer over other modules' data, and this rewrite follows the same shape as read
queries in `features/reports/queries.ts`. All 15 reports from the legacy catalog
(`legacy-reference/REPORTS_HUB_V11.md`) are implemented, grouped into the same 7 categories, with
the same collapsible category sidebar, generic From/To/Event/Status/Search filter bar, and an
auto-summed KPI strip over the first 4 numeric/money columns.

- **CSV export instead of Excel.** Legacy exports via SheetJS (`xlsx@0.18.5`) — the same package
  with unpatched high-severity advisories flagged in the Staff Master notes above. Same call made
  here: `exportReportCsv()` produces a `.csv` file instead, which opens identically in Excel/Sheets
  for tabular data without the dependency.
- **Consolidated the print-popup pattern.** Legacy duplicates the "open a window, write a styled
  HTML document, `window.print()`" pattern independently across Meetings, Finance's EXCO report,
  the Reimbursements report tab, and this hub — four separate implementations of the same idea.
  `features/reports/print.ts`'s `printReport()` is now the one shared implementation this module
  uses; it wasn't retrofitted into the already-migrated Meetings minutes-printing code to avoid
  touching working code, but it's the natural function for any future module's print feature to
  reuse instead of writing a fifth copy.
- **Typed per-report columns instead of legacy's dynamic/regex-driven ones.** Legacy infers each
  report's table columns from whatever keys happen to be present on the row objects, and detects
  money/status formatting by testing column names and cell values against regexes. This rewrite
  has each report declare its columns explicitly (`ReportColumn[]` with a real `type`), which the
  legacy research report itself flagged as the safer approach — no behavior difference for a user,
  just less brittle code.
- **"Email Status Report" only covers Reimbursements' Procurement email tracking**
  (`reimbursement_cases.email_sent_at`/`procurement_manager_email`). Legacy's version also unions
  in Finance's final-approval email tracking, but this rewrite's Finance module doesn't implement
  the secure email-approval-link flow yet (documented as deferred in the Finance section above) —
  there's no email data to report on for that half until that flow exists.
- **EXCO Activity Finance Report and the Reimbursements module's own Reports tab are not
  ported**, matching a genuine gap in the legacy app itself: both are older, separate,
  module-embedded report screens that were never unified into the central hub despite covering
  overlapping ground — the legacy `REPORT_DEFINITIONS` catalog never linked to them either, so
  this rewrite's 15-report hub has full parity with what the hub itself actually offers.
- **No pagination** on large reports (e.g. Expense Register, Reimbursement Master, AP Register),
  matching legacy's same all-rows-in-one-table approach — fine at current data volumes, worth
  revisiting if any table grows large.

### Known simplifications vs. the legacy build (Settings module)

- **Profile edits go through the `update_my_profile` RPC**, not a direct `profiles` table write —
  matching legacy's pattern and the RLS setup, where `profiles` only allows Administrators to write
  directly and self-service edits (display name, member/staff ID, contact number, avatar URL) must
  go through the security-definer RPC. Email, role, and account status remain read-only in this UI,
  same as legacy.
- **Profile Photo URL is a plain external URL field**, not a Storage upload — same as legacy, which
  never wired an avatar upload flow either despite having a `profiles.avatar_url` column.
- **Password strength meter is cosmetic only** (a client-side length/case/digit/symbol heuristic
  score), matching legacy — it doesn't enforce a minimum beyond Supabase Auth's own 8-character
  rule, and changing the password re-authenticates with the current password first via
  `signInWithPassword` before calling `auth.updateUser`, same flow as legacy.
- **"My Committee Leave" section is conditionally rendered** only for committee members
  (`get_my_committee_leave` RPC's `isCommitteeMember` flag), reusing the same three RPCs
  (`get_my_committee_leave`/`update_my_committee_leave`/`clear_my_committee_leave`) introduced in
  migration `030` — this closes the gap noted in the Committee module section above.
- **No account deactivation/deletion self-service**, matching legacy — account status changes
  remain an Administrator-only action elsewhere in the app.
- **"Sign Out Other Sessions"** uses Supabase Auth's `signOut({ scope: 'others' })`, equivalent to
  legacy's same-purpose action.

### Known simplifications vs. the legacy build (Participant Portal module)

Legacy's Participant Portal (`legacy-reference/PARTICIPANT_EXTERNAL_OFFICIAL_PORTAL_V12_8.md`) is a
distinct nav section (`My Hub` / `Activities` / `My Registrations` / `My Engagement` / `My
Reimbursements`) available to every authenticated user, backed by migration `023` (`event_teams`,
`event_registrations`, `event_team_messages`, `event_winners`, `external_event_officials`,
`external_event_reimbursements`, `external_reimbursement_history`) plus its eligibility-aware RPC
redefinitions in migration `027`. This rewrite (`src/features/portal/`) ports the same five-tab
shape and reuses the legacy CSS classes verbatim (`portal-*`, `external-approval-row`), which were
already present in `legacy.css` from the original build.

- **No anonymous/no-login access exists anywhere in this module, in legacy or in this rewrite.**
  Every Portal RPC and RLS policy already required an authenticated session in the legacy app —
  including External Event Official reimbursement submission and its Committee approval, both
  gated by `auth.uid()`/`is_committee_user()`, never a token. The user's instruction that "all
  approvers must log in" was already true here; the only genuinely no-login flow in this codebase
  was Finance's separate `expense-approval` Edge Function email-link chain, which is intentionally
  not implemented at all — see the Finance section above.
- **Team registration/join/decide/message RPCs (`self_register_event`, `create_event_team`,
  `request_join_event_team`, `approve_event_team_join`) are called directly**, unlike Tournaments'
  `create_tournament_team()` workaround — research confirmed no later migration redefines these
  with a conflicting return type, so the RPC path is safe to use as-is.
- **Tournament-linked events are not merged into this module's Activities list** — see the
  Tournaments module notes above; participants register for those from the Tournaments page.
- **Committee tooling (registration settings, official assignment, winner entry) lives in one combined
  "Configure" modal on each Activities card**, rather than legacy's separate settings/assign/winner
  screens — same three actions, consolidated into one place instead of three, similar in spirit to
  the Reports module's print-helper consolidation.
- **My Engagement uses the Portal's own legacy scoring formula** (registration +3, attendance +5,
  achievement +5, Starter/Bronze/Silver/Gold at 0/15/40/75) — a **separate system from the
  already-migrated Leaderboard module's scoring**, exactly as in legacy: the two were never unified
  upstream (Leaderboard only scores Events/Tournaments; Portal engagement is a simpler,
  registration-focused number shown to the participant themself). Not a rewrite gap — carried over
  faithfully as two distinct, intentionally separate scores.
- **Attendance credit for engagement matches on `staff_uid` only** (`profile.member_uid`), not the
  fuller UID→email→name fallback chain Leaderboard uses — a smaller, Portal-scoped simplification
  flagged the same way Leaderboard's own identity-resolution gap was flagged.
- **`supporting_document_name` on a reimbursement submission is a free-text label, not a file
  upload** — matching legacy exactly; the UI states bills are attached during AP submission,
  handled entirely by the already-migrated Reimbursements module once Committee approves.
- **Realtime subscriptions are not ported.** Legacy subscribes to a broad multi-table Postgres
  Changes channel across the whole Portal; this rewrite polls on reload/action instead, consistent
  with the same simplification already made in Tournaments for `tournament_team_messages`.
- **External Official assignment looks up an existing account by email** (`profiles.email`) rather
  than a searchable directory picker — functionally equivalent to legacy's `getCommitteeUserDirectory()`-backed
  lookup, just a plain email field instead of a typeahead.
- **`department_audience_map` (superseded by `staff_location_classification` in migration `028`) is
  not referenced anywhere in this module** — confirmed dead after `028` runs, per the research; only
  the current `staff_location_classification`-backed eligibility RPCs would be relevant here, though
  this rewrite's Portal does not yet call `get_my_staff_audience()`/`is_staff_eligible_for_event()`
  to gate registration eligibility client-side (server-side RLS still applies regardless) — a
  reasonable follow-up once the Portal's audience messaging needs to match Staff Master's rules
  more explicitly.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Other scripts: `npm run build` (production build), `npm start` (serve the production build),
`npm run typecheck` (`tsc --noEmit`), `npm run lint` (oxlint).

## Backend

The Supabase schema, RLS policies, RPCs, and Edge Functions are unchanged from the legacy build —
see `supabase/migrations/` and `supabase/functions/`. Run them against a Supabase project as
documented in `legacy-reference/README.md` and `legacy-reference/VERCEL_DEPLOYMENT.md` (the old
Vercel proxy config `api/config.js` is no longer needed: this app reads Supabase credentials from
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` at build time instead of a serverless
function, since the anon key is safe to ship to the client). Deploys natively on Vercel with zero
extra config — no `vercel.json` rewrite rules needed, unlike the old SPA build.

`NEXT_PUBLIC_*` env vars must be set in the hosting platform's project settings (e.g. Vercel →
Settings → Environment Variables), not just a local `.env.local` — they're inlined at build time,
so a redeploy is needed after adding/changing them. `src/lib/supabase.ts` falls back to a
syntactically valid placeholder URL/key when they're unset so the build/prerender step doesn't
crash; real Supabase calls fail loudly at runtime instead, with a console warning during the build.

Applying `supabase/migrations/` in order (skip the byte-identical duplicate `001_rebuild_
clubsphere.sql`) against a fresh project applies cleanly end-to-end — confirmed by actually doing
so against a live project while building this rewrite, which surfaced and fixed two pre-existing
issues in the migration files themselves (both now fixed at the source, not worked around):
9 files (`027`–`033`, `035`, `036`) had a stray literal `\` as their first line (a harmless no-op
psql meta-command, but a hard syntax error in a plain-SQL client like the Supabase SQL Editor), and
`033`'s `create_tournament_team()` redefinition was missing the `drop function if exists` needed
for its return-type change — see the Tournaments module notes above for that one.

## Project layout

```
src/
  app/                Next.js App Router routes
    (protected)/      Auth-gated routes for every migrated module, wrapped by layout.tsx
    login/             Login page
    layout.tsx, providers.tsx, globals.css, legacy.css
  lib/                Supabase client, auth context, toast context
  components/         Shared UI (layout shell, modal)
  features/
    events/           Events & Activities module (fully migrated)
    committee/        Committee module (fully migrated)
    meetings/         Meetings module (fully migrated)
    finance/          Finance module (core expense/approval lifecycle; Contingency deferred)
    reimbursements/   Reimbursements/AP module (no email dispatch; see notes above)
    tournaments/      Tournaments module (auto-provisioned only, no create UI)
    staff/            Staff Master + Location Classification (CSV import only, see notes above)
    leaderboard/      Leaderboard (computed, no dedicated schema)
    documents/        Documents (manual library + read-only Reimbursements evidence view)
    reports/          Reports hub — all 15 catalog reports, CSV export, shared print helper
    settings/         Settings (profile self-service, My Committee Leave, password, sessions)
    portal/           Participant Portal (activities, team registration, engagement, External Official reimbursements)
  types/              Hand-written Supabase row types
legacy-reference/     Original v13.15 index.html build, kept for migrating remaining modules
supabase/             Migrations and Edge Functions (unchanged from legacy)
```
