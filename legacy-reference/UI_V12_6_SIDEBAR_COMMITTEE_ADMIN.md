# UnitedBML V12.6

## Collapsible sidebar
- Collapse/expand button in the sidebar header
- Collapsed state persists in localStorage
- Icon-only collapsed navigation
- Main content expands automatically
- Sidebar navigation scrollbar is visually hidden while wheel/touch scrolling still works

## Committee Administrator workspace
Only users whose profile role is `Administrator` see **Configure Committee**.

Administrator can:
- create Committee Positions
- rename/edit positions
- define position groups
- set position icons
- set display order
- define `Reports To`
- remove positions
- assign/edit members
- configure reporting structure

The Structure tab is now generated dynamically from the saved `Reports To`
relationships instead of a hard-coded chart.

Existing committee assignments continue to use the existing authenticated
UnitedBML user directory and Committee term workflow.
