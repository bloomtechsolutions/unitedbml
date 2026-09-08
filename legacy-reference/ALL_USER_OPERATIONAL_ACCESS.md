# All-User Operational Access

## New access model

Every active authenticated UnitedBML user can now perform operational work across:
- Events & Activities
- Attendance
- Meetings
- Committee administration
- Budget maintenance
- Expense request creation
- Actual expense settlement
- Reimbursements
- Procurement pre-approval
- Procurement response recording
- AP submissions and status updates
- Reports and operational email actions

This removes the dependency on the Treasurer or a small set of inputter roles being available.

## Approval controls are NOT opened

### Standard expense route
Any signed-in user submits
→ President recommends/rejects
→ selected Vice Chairperson or Chairperson final-approves/rejects.

### President on leave
If Committee Management marks the President `On Leave` for the expense date:

Any signed-in user submits
→ President stage is skipped
→ request becomes `Pending Final Approval`
→ secure final approval email goes directly to the selected Vice Chairperson / Chairperson.

### Database protection
Migration 019 adds a trigger so frontend access changes cannot bypass approval authority:
- Pending President Recommendation → Pending Final Approval/Rejected: President only
- Pending Final Approval → Approved/Rejected: selected Vice Chairperson/Chairperson only
- Approved → Reversed: President only

## Deliberate exception
User/profile role administration stays restricted. If every user could change their own role to President or Chairperson, the approval control would be meaningless.

## Deployment
1. Run migration `019_all_user_operational_access_with_approval_guards.sql`.
2. Redeploy the `expense-approval` Supabase Edge Function.
3. Redeploy the Vercel package.
