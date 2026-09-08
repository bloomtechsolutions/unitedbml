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
| Finance | ✅ Migrated (requests, President/Final approval chain, reversals, budget tracking) — AP/Contingency/vendor master deferred, see below |
| Tournaments | ⏳ Not yet migrated — placeholder page |
| Reimbursements | ⏳ Not yet migrated — placeholder page |
| Leaderboard | ⏳ Not yet migrated — placeholder page |
| Communication | ⏳ Not yet migrated — placeholder page |
| Documents | ⏳ Not yet migrated — placeholder page |
| Reports | ⏳ Not yet migrated — placeholder page |
| Staff Master / Location Classification | ⏳ Not yet migrated — placeholder page |
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

- **Accounts Payable (AP) batches/bills and Reimbursements** (`ap_batches`, `ap_bills`,
  `reimbursement_cases`, `reimbursement_history`, vendor master) are a separate nav module in the
  legacy build (`data-view="reimbursements"`) and out of scope here — Finance only reads
  `expense_requests`/`expense_lines`/`budgets`.
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
    finance/          Finance module (core expense/approval lifecycle; AP/Contingency deferred)
  types/              Hand-written Supabase row types
legacy-reference/     Original v13.15 index.html build, kept for migrating remaining modules
supabase/             Migrations and Edge Functions (unchanged from legacy)
```
