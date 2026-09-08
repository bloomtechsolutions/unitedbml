# UnitedBML Management Hub

Modernized rebuild of the UnitedBML club management application: Vite + React + TypeScript on the
frontend, Supabase (Postgres + Auth) on the backend. This replaces the previous architecture, a
single ~12,500-line `index.html` file with vanilla JS DOM rendering (preserved for reference in
`legacy-reference/`), with a component-based, typed codebase migrated module by module.

## Status

This is an in-progress rewrite. Modules are migrated one at a time to guarantee each one fully
preserves the original business logic before moving to the next.

| Module | Status |
|---|---|
| Auth, layout shell, navigation | ✅ Migrated |
| Events & Activities | ✅ Migrated (core CRUD, tasks, attendance, lifecycle automation) |
| Tournaments | ⏳ Not yet migrated — placeholder page |
| Finance | ⏳ Not yet migrated — placeholder page |
| Reimbursements | ⏳ Not yet migrated — placeholder page |
| Meetings | ⏳ Not yet migrated — placeholder page |
| Committee | ⏳ Not yet migrated — placeholder page |
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
  plus the `Cancelled` state) is ported faithfully **except** for the Finance-approval condition,
  since the Finance module hasn't been migrated yet — once it is, `eventLifecycle()` in
  `src/features/events/lifecycle.ts` needs the `financeReady` check restored.
- Attendance bulk import from Excel and the meeting-agenda → event creation linkage are not yet
  ported (both depend on modules not yet migrated: attendance Excel import needs the `xlsx`
  library wiring, agenda linkage needs the Meetings module).
- Writes go straight to Supabase from the browser (no more localStorage-as-source-of-truth +
  debounced sync queue) — this is an intentional architectural simplification enabled by the
  rewrite, not a temporary gap.

## Getting started

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Backend

The Supabase schema, RLS policies, RPCs, and Edge Functions are unchanged from the legacy build —
see `supabase/migrations/` and `supabase/functions/`. Run them against a Supabase project as
documented in `legacy-reference/README.md` and `legacy-reference/VERCEL_DEPLOYMENT.md` (Vercel
proxy config `api/config.js` is no longer needed: this app reads Supabase credentials from
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` at build time instead of a serverless function, since
the anon key is safe to ship to the client).

## Project layout

```
src/
  lib/            Supabase client, auth context, toast context
  components/     Shared UI (layout shell, modal)
  pages/          Top-level routed pages (dashboard, login, placeholders)
  features/
    events/       Events & Activities module (fully migrated)
  types/          Hand-written Supabase row types
legacy-reference/ Original v13.15 index.html build, kept for migrating remaining modules
supabase/         Migrations and Edge Functions (unchanged from legacy)
```
