# UnitedBML V12.9.2

Staff Master fields:
- UID
- Name
- Job Title
- Division
- Department
- Unit

Administrator gets:
- Staff Master page
- Excel / CSV bulk import
- downloadable template
- manual edit/add
- Division/Department/Unit filters
- missing organizational-data indicators

Location classification now resolves:
1. Unit
2. Department fallback
3. Unclassified

Run migration:
`supabase/migrations/028_staff_master_location_classification.sql`

Then import the Staff Master and configure Location Classification.
