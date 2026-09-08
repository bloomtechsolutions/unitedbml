# UnitedBML V12.9.6 Meeting Attendance UX Fix

## Problem
Changing a Committee Attendance dropdown called `openMeetingWorkspace(mid)`.
That rebuilt the entire Meeting Workspace and always activated Overview.

Result:
Attendance selection → workspace jumps to Overview.

## Fix
Attendance now saves in place.

After Expected / Present / Absent / Excused is selected:
- the user remains on Attendance
- the dropdown remains where it is
- the row status updates immediately
- attendance counts/rate update immediately
- Meeting Minutes content is refreshed silently
- the Meetings listing behind the modal is refreshed
- the Meeting Workspace is not reopened

No database migration is required.
