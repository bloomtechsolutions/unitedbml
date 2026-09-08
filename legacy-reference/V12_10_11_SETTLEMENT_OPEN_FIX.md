# UnitedBML V12.10.11

## Fix
The new Finance / Settlements register passes an Event ID through an HTML button.
That value is a string.

`openActualExpenseSettlement()` previously used:

`events.find(e => e.id === eventId)`

If the Event ID in application state was numeric, the lookup silently failed
because `123 !== "123"`.

The launcher now:
- normalizes Event IDs with `String(...)`
- resolves the real Event before continuing
- uses the Event's stored ID for approved-expense lookup
- verifies required settlement DOM controls exist
- reports a visible error instead of silently returning
- catches loading/rendering errors
- safely encodes Event IDs in the Finance register button

No SQL migration is required.
