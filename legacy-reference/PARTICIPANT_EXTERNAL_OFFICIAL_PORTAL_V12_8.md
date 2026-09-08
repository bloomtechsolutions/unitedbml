# UnitedBML V12.8 Participant & External Event Official Portal

## Role separation

### Committee / Management users
The existing UnitedBML management application remains available to explicit Committee roles:
- Administrator
- Chairperson
- Vice Chairperson
- President
- Treasurer
- Secretary
- Communications Coordinator
- Male Coordinators
- Atoll Coordinator / Representative
- the three configured HR Head final-approver roles

### Staff / Participants
Normal Staff Member users now receive a separate portal-focused navigation:
- My Hub
- Activities
- My Registrations
- My Engagement

They do not receive Finance, Committee, Meetings, Reports, Settings or management editing screens.

### External Event Officials
An authenticated user can be assigned to an approved Event as:
- Team Manager
- External Event Official
- or another official role entered by Committee

Official assignment is per Event and does not make the person a Committee user.

## Participant event experience
Committee can open **Participant Portal** from the management navigation and configure each Event:
- registration enabled / disabled
- Individual or Teams mode
- registration open / close date
- capacity
- team size
- participant rules

Participants can:
- browse upcoming activities
- open Event details
- read rules
- see Event status
- see winners/results
- self-register for Individual events
- create a Team for Teams-mode events
- become Team Leader automatically
- browse open Teams and request to join
- use a Team QR / join link
- view their Team roster
- use a private Team Discussion area

Team join requests require Team Leader or Committee approval.

## Engagement
My Engagement derives a simple personal indicator:
- registration: +3
- attended event: +5
- event achievement: +5
- winner/champion: +10

This is an engagement indicator, not a payroll/performance score.

## External Official reimbursement flow

1. Committee assigns an authenticated user to the Event as an External Event Official / Team Manager.
2. The Event must already have an **Approved expense request**.
3. The official submits a reimbursement from **My Reimbursements**.
4. Status becomes `Pending Committee Approval`.
5. A Committee member approves or rejects it from the existing Reimbursements module.
6. On approval, Supabase automatically creates a normal `reimbursement_cases` row with:
   - Route: `External Official`
   - Status: `Pre-Approved`
7. That case immediately enters the existing **Bills & Accounts Payable** workflow.
8. Treasurer / Committee creates AP batches, attaches bills and follows:
   - Draft
   - Sent to AP
   - Processing
   - Paid
   - Returned / Query
9. The External Official sees the progress in My Reimbursements.

Committee approval is therefore the gate between External Official submission and the existing AP process.

## Security changes
Migration 023 replaces the earlier "all authenticated users can operate everything" behavior from migration 019.

- public Event content: active authenticated users may read
- Event/Finance/Committee/Meeting management: Committee only
- participant registrations: user/team scoped
- team discussions: Team members + Committee only
- External Official assignments: official + Committee only
- External reimbursement requests: submitting official + Committee only
- reimbursement/AP rows created from an External Official submission: official can read, Committee manages
- personal notifications remain user scoped

## Deployment
Run:

`supabase/migrations/023_participant_external_official_portal.sql`

No new Edge Function or Cron job is required.

After the migration, redeploy the V12.8 Vercel package.
