# UnitedBML V12.9.4 Committee ↔ Staff Master Linkage

## Principle
A Committee appointment does not change a staff member's BML organizational home.

### Staff Master owns
- UID
- Name
- Job Title
- Division
- Department
- Unit

### Committee owns
- Committee Position
- Committee Group
- Committee Term
- Status / Availability
- Leave dates
- Responsibilities / Notes

Committee records now hold references:
- `user_id`
- `staff_uid`

They do not own Division, Department or Unit.

## Matching order
Committee member assignment resolves the Staff Master record by:
1. `profiles.member_uid` / Staff UID
2. email fallback

UID is the primary key.

## Committee UI
The member picker now shows:
- Job Title
- Division
- Department
- Unit
- Malé / Atoll classification
- Staff Master match status

Committee cards, Directory and Profile views display current Staff Master
organizational information.

If a staff member transfers Department or Unit and the Staff Master is updated,
their Committee position remains unchanged while the Committee view reflects the
new organizational placement.

## Staff Master
Staff Master now displays a UnitedBML column. Committee members show their
Committee position while remaining in their original Division/Department/Unit.

## Deployment
Run:
`supabase/migrations/029_committee_staff_master_linkage.sql`

Then deploy V12.9.4 to Vercel.

No new Edge Function or Cron job is required.
