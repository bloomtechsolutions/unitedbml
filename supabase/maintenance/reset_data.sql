-- UnitedBML: full data reset — everything EXCEPT committee_members and profiles.
--
-- Run this manually in the Supabase SQL editor when you actually want to wipe the
-- database back to a clean slate. This is NOT part of the numbered migration chain —
-- do not rename it into supabase/migrations/, or a fresh deploy would wipe itself.
--
-- What this does NOT do:
--  - It does not touch auth.users, committee_members, or profiles.
--  - It does not delete files already uploaded to Supabase Storage (receipts, evidence,
--    documents). Their DB rows (document_registry, attachments, bill/procurement
--    attachment paths) are cleared, but the objects themselves stay in the bucket —
--    empty the relevant Storage buckets separately from the dashboard if you want those
--    gone too.
--  - app_settings, event_types and vendor_master are reference/config tables rather than
--    transactional history — they're wiped along with everything else per "clear all the
--    tables", but you'll need to reseed them (or restore from your own backup) if you
--    still want that configuration afterwards.
--
-- Irreversible. Take a Supabase backup/point-in-time snapshot first if there's any chance
-- you'll want this data back.

begin;

truncate table
  public.ap_batches,
  public.ap_bills,
  public.app_settings,
  public.attachments,
  public.audit_log,
  public.budgets,
  public.committee_leave_history,
  public.contingency_requests,
  public.department_audience_map,
  public.document_registry,
  public.email_log,
  public.event_actual_expenses,
  public.event_attendance,
  public.event_registrations,
  public.event_task_history,
  public.event_tasks,
  public.event_team_messages,
  public.event_teams,
  public.event_types,
  public.event_winners,
  public.events,
  public.expense_approvals,
  public.expense_lines,
  public.expense_requests,
  public.expense_reversals,
  public.external_event_officials,
  public.external_event_reimbursements,
  public.external_reimbursement_history,
  public.meeting_action_history,
  public.meeting_actions,
  public.meeting_agenda,
  public.meeting_attendees,
  public.meeting_decisions,
  public.meetings,
  public.notifications,
  public.reimbursement_cases,
  public.reimbursement_history,
  public.staff,
  public.staff_location_classification,
  public.standing_allocation_entries,
  public.standing_allocations,
  public.tournament_matches,
  public.tournament_registrations,
  public.tournament_team_messages,
  public.tournament_teams,
  public.tournament_updates,
  public.tournament_winners,
  public.tournaments,
  public.vendor_master
restart identity cascade;

-- Restore the five Standing Allocations activities to their out-of-the-box state
-- (same seed as migration 050) so the module isn't left empty after the reset.
insert into public.standing_allocations (name, cadence, budget_year, allocated_amount)
values
  ('Fun with Team', 'Monthly', extract(year from now())::int, 0),
  ('UBML Allowance', 'Monthly', extract(year from now())::int, 0),
  ('Women''s Day', 'Annual', extract(year from now())::int, 0),
  ('Men''s Day', 'Annual', extract(year from now())::int, 0),
  ('Year End Activities', 'Annual', extract(year from now())::int, 0)
on conflict (name, budget_year) do nothing;

commit;
