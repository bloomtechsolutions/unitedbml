# Configurable Committee Term

The Committee term is stored in Supabase `app_settings` under:

`clubCommitteeTermV1`

Authorized Committee managers can use **Set / Edit Term** from the top Committee Term area.

Changing the term:
- recalculates progress
- updates the displayed term everywhere
- updates current assigned-member term dates
- becomes the default for new assignments
- syncs to Supabase

Migration 018 seeds 01 Jan 2026 to 31 Dec 2027 as the initial term. It is fully editable after deployment.
