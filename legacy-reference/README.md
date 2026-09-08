# Vercel Build

See `VERCEL_DEPLOYMENT.md` for Vercel deployment instructions.

# UnitedBML Rebuilt: Netlify + Supabase

This build preserves the original UnitedBML HTML application and replaces the unreliable demo/local-only persistence layer with a normalized Supabase sync layer.

## What changed

- Original UnitedBML screens and workflows retained.
- Operational demo data removed from HTML.
- Supabase Auth used for real user sessions and roles.
- 30 normalized Supabase tables.
- All persisted HTML business entities mapped to columns/child tables.
- One ordered synchronization queue instead of overlapping localStorage mirrors.
- Empty Supabase tables clear stale browser/demo records during hydration.
- Inserts, edits and deletes synchronize to Supabase.
- Sync state is shown in the top bar (`connecting`, `syncing`, `synced`, `sync error`).
- Gmail email sending is handled by a Supabase Edge Function and logged in `email_log`.
- Procurement/reimbursement and AP emails support attachments.

See `FIELD_MAPPING_AUDIT.md` for the detailed mapping.

## 1. Rebuild the Supabase database

> WARNING: the migration below intentionally removes existing UnitedBML operational/test data. Back up any real data first. Supabase Auth users are not dropped.

Open Supabase -> SQL Editor and run:

`supabase/migrations/001_rebuild_clubsphere.sql`

The file `supabase/migrations/001_clubsphere_full.sql` is an identical compatibility copy.

## 2. Netlify environment variables

In Netlify -> Project configuration -> Environment variables, set exactly:

- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_ANON_KEY` = your Supabase publishable/anon key

Do not put the Supabase service-role key in Netlify/browser configuration.

After changing variables, redeploy the site.

## 3. Gmail Edge Function

Deploy:

`supabase/functions/send-email/index.ts`

Configure these Supabase Edge Function secrets:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM_EMAIL`

The function requires an authenticated UnitedBML user and records sends in `email_log`.

## 4. Create users and assign roles

Create users in Supabase Authentication. Then assign the application role in `public.profiles`.

Example:

```sql
update public.profiles
set full_name = 'Your Name', role = 'Administrator'
where email = 'your@email.com';
```

Use one of the UnitedBML roles expected by the HTML application.

## 5. First-run verification

After login, a clean database should show no operational records. Create one event and verify `public.events` immediately. Edit that event and confirm the same row changes. Then delete it and confirm the row is removed.

Repeat a smoke test for:

1. Committee assignment -> `committee_members`
2. Staff import/manual staff -> `staff`
3. Event/task/attendance -> `events`, `event_tasks`, `event_attendance`
4. Meeting/agenda/action -> `meetings`, `meeting_agenda`, `meeting_actions`
5. Expense and sub-expenses -> `expense_requests`, `expense_lines`
6. Approval -> `expense_approvals`
7. Reimbursement -> `reimbursement_cases`
8. AP batch/bills -> `ap_batches`, `ap_bills`

The top-bar database badge should finish at `DB: synced`. If it changes to `DB: sync error`, open the browser console and Supabase logs to inspect the failing operation instead of assuming the browser save reached the database.

## Important architectural note

The original application still uses localStorage internally as a compatibility cache because many UI functions were written against it. It is no longer the intended durable data store. The backend intercepts saves, serializes them through an ordered queue, writes normalized Supabase tables, and hydrates the UI back from Supabase after authentication.

A selected parent table may also contain a `data JSONB` snapshot. This exists to prevent loss of uncommon legacy HTML fields while the normalized columns/child tables remain the primary schema.
