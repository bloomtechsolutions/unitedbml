# Extended Final Approval Pool

Final approval can now be assigned to any available active Committee member holding one of these positions:

1. Vice Chairperson
2. Chairperson
3. Head of Total Rewards & Employee Relations
4. Head of Talent Acquisition & People Development
5. Head of Employee Experience & HR Business Partnering

## Availability behavior

The expense form only lists final approvers who are:
- assigned in Committee
- Active
- Available
- have one of the approved final-approver roles

Anyone marked **On Leave** is excluded from the final-approver dropdown.

## Approval flow

### President available
Any signed-in user submits
→ President recommendation
→ selected available final approver
→ Approved / Rejected

### President on leave
Any signed-in user submits
→ President recommendation is skipped
→ selected available final approver
→ Approved / Rejected

The same secure one-time approval link and automatic final-approval email are used for all five final-approver roles.

## In-app approval

In-app final approval is tied to the selected approver's identity (email/name), not merely to a generic profile role. This means a Head assigned in Committee can approve without needing to change their authentication profile role to the full Head designation.

## Deployment

1. Run `supabase/migrations/020_extended_final_approvers.sql`.
2. Redeploy the Vercel package.
3. No Edge Function code change is required for the role expansion because the secure final-approval link is already tied to the selected expense approver/token.
4. Assign users and email addresses to the three new Committee approver positions.
