# UnitedBML V12.10.4 Registration State Synchronization Fix

## Root cause
Tournament and Participant Portal were using different registration checks.

Tournament:
- `tournaments.status = Registration Open`

Participant Portal:
- `events.registration_enabled`
- `events.registration_open_at`
- `events.registration_close_at`
- `events.registration_mode`

This allowed the Tournament page to show Registration Open while the participant
view said Registration is not currently open.

## Fix

### Shared participant resolver
`portalRegistrationState(event)` now resolves:
- linked Tournament status
- Event registration enabled flag
- registration mode
- opening date/time
- closing date/time

For a linked Tournament explicitly marked `Registration Open`, the Participant
Portal also treats registration as open unless the configured closing boundary
has passed.

### Tournament → Event synchronization
Saving Tournament Setup now synchronizes:
- registration enabled
- registration mode
- registration open/close dates
- rules
- participant capacity
- team size

If the Tournament is explicitly set to Registration Open with no opening date,
a stale Event opening timestamp is cleared instead of blocking registration.

### Event → Tournament synchronization
Saving Participant Registration Settings now synchronizes the linked Tournament:
- tournament mode
- rules
- registration dates
- capacity/team size
- Tournament registration status

## Date handling
Tournament date-only closing dates are treated as end-of-day (23:59:59), not
midnight at the start of the closing date.

## Database
No SQL migration is required.
