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
| Leaderboard | ⏳ Not yet migrated — placeholder page |
| Communication | ⏳ Not yet migrated — placeholder page |
| Documents | ⏳ Not yet migrated — placeholder page |
| Reports | ⏳ Not yet migrated — placeholder page |
| Participant Portal / external approval pages | ⏳ Not yet migrated |

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
  RPCs) lives on the legacy Settings page, not the Committee page itself, and Settings hasn't been
  migrated yet — deferred until then.
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
  signing in) is not implemented. All approval decisions in this rewrite happen in-app, from an
  authenticated session — the `guard_expense_approval_transition()` DB trigger enforces the same
  rules either way, so this is a pure UI/access-path gap, not a data-integrity one. It's a
  legitimately separate concern (a public route + Edge Function/service-role path, not normal
  RLS-scoped client queries) worth its own future pass rather than folding into this one.
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
  through some channel today. Wiring the real Edge Function send is a natural next step once the
  Documents/Communication modules (which likely share attachment/PDF tooling) are in scope.
- **Single-send protection is simplified** to one re-check of the batch's current status
  immediately before flipping it to `Sent to AP` (blocks a double-click/stale-tab resend). The
  legacy build's three-layer guard (in-memory mutex, a 2-minute stale-lock timestamp for
  crashed sends, and a server-side idempotency key passed to the email provider) doesn't apply
  here since there's no actual async email step to protect against yet — this can be revisited
  once real sending is added.
- **External Event Official self-service reimbursements** (`external_event_reimbursements`, the
  RPCs `submit_external_event_reimbursement`/`decide_external_event_reimbursement`, and the
  approval card that surfaces them at the top of the Reimbursements page) are not ported — they
  belong to the not-yet-migrated Participant Portal.
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

- **`create_tournament_team()` is a genuinely broken RPC in the legacy migration history** — worth
  flagging since it's a real bug, not a rewrite simplification. Migration `027a` sets its return
  type to `jsonb`; migration `033` later does `create or replace function
  public.create_tournament_team(...) returns public.tournament_teams` **without a preceding `drop
  function`**, which Postgres rejects for a return-type change (error `42P13`). Applied
  sequentially, `033`'s statement — and everything after it in the same transaction, including its
  department-resolution backfill — would fail. This rewrite sidesteps the RPC entirely: team
  creation goes through two direct inserts (`tournament_teams` then `tournament_registrations`),
  which the existing RLS insert policies already allow for a user creating their own team. See
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
- **Participant Portal self-service** (staff registering for a tournament through the general Event
  browsing UI, rather than through this dedicated Tournaments page) is not implemented — the
  Portal itself is still unmigrated. When it is, it should call the same
  `createTeam`/`requestJoinTeam`/`selfRegisterIndividual` logic (or the underlying RPCs/inserts)
  rather than duplicating tournament registration logic, since the legacy build's Portal and
  Tournaments-section registration flows share one backend surface.
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

## Project layout

```
src/
  app/                Next.js App Router routes
    (protected)/      Auth-gated routes: dashboard, events, and placeholder pages, wrapped by layout.tsx
    login/             Login page
    layout.tsx, providers.tsx, globals.css, legacy.css
  lib/                Supabase client, auth context, toast context
  components/         Shared UI (layout shell, modal)
  shared/             Small shared components (Placeholder)
  features/
    events/           Events & Activities module (fully migrated)
    committee/        Committee module (fully migrated)
    meetings/         Meetings module (fully migrated)
    finance/          Finance module (core expense/approval lifecycle; Contingency deferred)
    reimbursements/   Reimbursements/AP module (no email dispatch; see notes above)
    tournaments/      Tournaments module (auto-provisioned only, no create UI)
    staff/            Staff Master + Location Classification (CSV import only, see notes above)
  types/              Hand-written Supabase row types
legacy-reference/     Original v13.15 index.html build, kept for migrating remaining modules
supabase/             Migrations and Edge Functions (unchanged from legacy)
```
