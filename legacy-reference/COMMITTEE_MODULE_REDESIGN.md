# Committee Module Redesign

Applied to the full UnitedBML Finance / Approvals / Exco Vercel + Supabase package.

- President Availability / Set Leave section removed from the Committee page.
- Interactive committee cards added.
- Search, group, status and sorting filters added.
- Assigned / Vacant / Available / On Leave summary chips added.
- Assign/Edit Member loads active authenticated users from Supabase profiles.
- Already assigned users are excluded.
- Selection auto-fills name, UID/contact when available, email and term dates.
- Staff table is used as a UID/contact fallback by email or full name.
- Structure and Directory tabs are retained.

Run `supabase/migrations/017_committee_user_directory.sql` before deployment.
No Edge Function redeploy is required for this Committee-only change.
