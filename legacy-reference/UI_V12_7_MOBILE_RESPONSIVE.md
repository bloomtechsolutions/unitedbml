# UnitedBML V12.7 Mobile Responsive

V12.7 adds a dedicated phone UX layer while preserving the desktop/tablet layout.

## Phone navigation
Below 760px:
- fixed desktop sidebar is removed from the visible canvas
- hamburger button opens a slide-out navigation drawer
- backdrop closes the drawer
- navigation closes automatically after selecting a module
- Escape closes the drawer
- sidebar scrollbar remains visually hidden
- touch/wheel scrolling remains available

## Phone layout
- full-width content
- compact sticky search bar
- stacked page headers/actions
- touch targets enlarged
- KPI cards collapse from multi-column to 2-column, then 1-column on very small phones
- tabs become horizontally swipeable
- forms become single-column
- action buttons become full width

## Modals
Modals become bottom-sheet/full-width panels with a sticky header and mobile scrolling.

## Dense modules
Responsive treatment was added for:
- Executive / My Dashboard
- Events & Activities
- Committee positions, directory, structure and Administrator configuration
- Tournaments, registration, team management and match screens
- Finance
- Reimbursements
- Reports
- Leaderboard
- Communication

Selected operational tables switch to mobile card presentation where their structure is suitable.
Large complex tables remain horizontally swipeable instead of being squeezed unreadably.

## Login
The branded UnitedBML login and animated Loading Management Hub experience scale to small phones.

No database migration is required.
