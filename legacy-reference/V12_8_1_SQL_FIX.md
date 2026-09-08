# UnitedBML V12.8.1 SQL Fix

V12.8 had one typo in the `external_reimbursement_history` RLS policy.

The table column is:
`external_reimbursement_id`

The faulty V12.8 policy referenced a different name.

If the V12.8 migration stopped at this error, either rerun the corrected
`023_participant_external_official_portal.sql`, or run only
`023a_external_reimbursement_history_policy_fix.sql` if all earlier statements
had already completed successfully.
