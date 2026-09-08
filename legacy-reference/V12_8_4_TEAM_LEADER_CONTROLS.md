# UnitedBML V12.8.4 Team Leader Controls

Fixes the remaining `operator does not exist: text = uuid` error by making
Tournament registration-id and team-id comparisons text-normalized.

Team Leader behavior:
- sees Approve for pending join requests
- does not see Reject
- can remove approved members from their own team
- cannot remove themselves / the Team Leader

Committee behavior:
- can Approve or Reject pending join requests
- can remove approved team members

Run:
`supabase/migrations/026_tournament_team_leader_controls_and_id_compatibility.sql`
