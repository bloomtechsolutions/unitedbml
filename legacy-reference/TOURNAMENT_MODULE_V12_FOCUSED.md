# UnitedBML V12 - Focused Tournament Module

This build returns to the Reports Hub V12 application baseline and adds only the requested Tournament workflow.

## Automatic creation
An eligible sports/tournament Event automatically receives a Tournament workspace when either:
- the Event status becomes `Approved`, or
- a linked Expense Request becomes `Approved`.

The provisioning trigger is idempotent: one Event creates one Tournament workspace.

Eligible Tournament/Sports Events are detected from the Event type/name or `event.data.isTournament=true`.

## Tournament workspace
Main areas:
1. Overview
2. Registration
3. Teams
4. Match Schedule
5. Live Screen
6. Results & Stats

## Registration
### Individual
- Self Register button
- identity is pulled from the authenticated UnitedBML profile/staff record
- registration status is visible

### Teams
- staff can create a Team
- creator automatically becomes Team Leader
- every Team receives a join code and QR/link
- staff can browse available teams and request to join
- Team Leader approves or rejects requests

## Private Team Page
Only approved Team members and Committee members can read the private Team page.
It includes:
- Team Leader
- approved member details
- UID
- email
- contact
- department
- pending join requests (leader/Committee action)
- Team QR invite
- private Team Discussion log

Privacy is enforced with Supabase RLS, not only hidden in the frontend.

## Tournament information
- Tournament Status
- live tournament timeline
- tournament rules
- registration counts and pending requests
- match schedules
- live / completed scores
- tournament updates
- pinned Live Screen announcements
- winners / awards

Tournament updates, matches, registrations and Team discussions use Supabase Realtime subscriptions.

## Stats
Results & Stats displays:
- Registered Staff
- engagement rate against the active Staff Registry
- Team count
- completed matches
- Department registration counts
- Department share of tournament registrations

## Supabase
Run:
`supabase/migrations/022_simple_tournament_module.sql`

No new Edge Function is required for this focused Tournament module.

## Tables
- tournaments
- tournament_teams
- tournament_registrations
- tournament_team_messages
- tournament_updates
- tournament_matches
- tournament_winners

## Important
This build intentionally does NOT include the heavier V15-V17 Tournament architecture such as points ledgers, graded-player quotas, rotating signed attendance QR, scorekeeper roles, automated bracket engines or multiple Cron functions.

## V12.1 legacy-schema compatibility fix

If an earlier Tournament module was already installed in the same Supabase project,
`CREATE TABLE IF NOT EXISTS` does not add the focused-V12 columns to those existing tables.

V12.1 therefore upgrades legacy Tournament tables before creating helper functions and RLS policies.

This specifically fixes:

`ERROR: 42703: column t.leader_user_id does not exist`

For a database where migration 022 already stopped at that error:

1. Run `022a_tournament_legacy_schema_compatibility.sql`
2. Rerun the complete `022_simple_tournament_module.sql`

The full 022 migration is now designed to reset older Tournament RLS policies and apply the focused-V12 privacy rules.

## V12.2 Tournament match schema compatibility

V12.2 additionally upgrades older `tournament_matches` tables.

This fixes:

`column tournament_matches.match_date does not exist`

The compatibility layer adds the focused-V12 match fields and backfills legacy
fixture fields such as `fixture_date`, `fixture_time`, and `court` when they exist.

For a project where the previous migration already stopped:

1. Run `022b_tournament_matches_legacy_compatibility.sql`
2. Rerun `022_simple_tournament_module.sql`

## V12.3 registration legacy-column compatibility

V12.3 fixes legacy `tournament_registrations` tables where `player_name`
was still a mandatory column from an older Tournament module.

The focused V12 module uses `staff_name`. V12.3:

- removes the legacy `player_name NOT NULL` blocker
- backfills `staff_name` from `player_name`
- backfills `player_name` from `staff_name`
- synchronizes both fields on future inserts/updates
- relaxes other obsolete legacy registration columns such as `registered_at`,
  `registration_mode`, and `registered_by` when they exist

For a database already showing the error, run:

`022c_tournament_registration_player_name_compatibility.sql`

Then rerun:

`022_simple_tournament_module.sql`
