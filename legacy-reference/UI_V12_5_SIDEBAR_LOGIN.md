# UnitedBML V12.5 UI refinement

## Sidebar
The former top-right account/action cluster has been moved into a compact sidebar utility area:
- user/profile
- notification bell
- DB sync badge
- Quick Add
- Health Check
- Sign out

The top bar is now dedicated to search.

## Engagement
Only:
- Leaderboard
- Communication

remain under Engagement.

The Leaderboard derives a lightweight engagement score from event attendance,
completed assigned work, tournament registration and tournament winner records.

## Login
The login page no longer exposes technical Supabase loading messages.

After email/password submission, the form transitions to a branded animated
UnitedBML loader with:
- animated logo/orbits
- Loading Management Hub
- short workspace-preparation status text

If authentication fails, the normal login form returns with the error.
