# Dashboard UI Enhancement

## Changes made
- Removed the static **Expense Approval Workflow** box from Finance Dashboard.
- Recreated **Budget Utilization** as an interactive widget:
  - toggle between Approved / Actual / Planned views
  - radial utilization ring
  - comparison bars
  - additional insight cards
- Added interactive approval-stage timeline to each **Recent Expense Request** card.
- Added filters to **Recent Expense Requests**:
  - Search
  - Status
  - Date range

## Functional notes
- Recent expense timeline adapts when President is on leave and the request goes directly to Final Approval.
- Recent dashboard list shows up to 8 filtered requests.
- Filters are client-side and update instantly.
