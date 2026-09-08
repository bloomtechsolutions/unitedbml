# UnitedBML V12.8.2 Event ↔ Tournament Synchronization

This update removes the data mismatch between:
- Events & Activities
- Participant Portal
- Tournaments

## Shared source of truth

A Tournament remains linked to its source Event through `tournaments.event_id`.

Tournament-specific competition data remains in Tournament tables:
- teams
- registrations
- match schedule
- live updates
- winners

Participant-facing shared Event fields are synchronized automatically.

## Tournament Setup → Event / Participant Portal

Saving Tournament Setup now synchronizes:
- Event name
- Event date from Tournament start date
- venue
- registration mode
- registration enabled / disabled
- registration opening date
- registration closing date
- participant rules
- participant capacity
- team size
- Tournament status metadata
- sport metadata

`Registration Open` enables Event registration.
Other Tournament states disable new Event registration.

## Event → Tournament

Updating the source Event or Participant Registration Settings synchronizes:
- Event name
- Event date
- venue
- Individual / Teams mode
- registration dates
- rules
- participant capacity
- team size

If the Tournament is still in Setup / Registration stages, enabling Event
registration changes the Tournament to `Registration Open`.

## Registration source of truth

For an Event linked to a Tournament, Participant Portal does NOT maintain a
second registration/team copy.

Participant Portal now uses:
- `tournament_registrations`
- `tournament_teams`
- `tournament_team_messages`

directly.

This means registration counts, team membership, join approvals and team
discussion are identical in Participant Portal and Tournament views.

Non-tournament Events continue using:
- `event_registrations`
- `event_teams`
- `event_team_messages`

## Competition information in Participant Portal

For linked Tournament Events, Event Details now also shows:
- Tournament status
- Tournament rules
- Match Schedule
- Live Updates
- Winners / Results

Tournament winners are additionally synchronized into `event_winners` so other
Event-facing views can display them without manual re-entry.

## Realtime

Participant Portal Realtime subscriptions now include:
- tournaments
- tournament teams
- tournament registrations
- tournament team messages
- tournament updates
- tournament matches
- tournament winners

## Deployment

Run:

`supabase/migrations/024_event_tournament_sync.sql`

after the corrected V12.8.1 migration.

Then deploy the V12.8.2 package to Vercel.

No new Edge Function or Cron job is required.
