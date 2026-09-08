# UnitedBML V13.14 Recovery Premium Corporate UI

Rebuilt from the exact V12.10.11 settlement-open-fix-full package after identifying the broken runtime UI patch.

## Root cause fixed
A previous runtime patch was inserted at a `</body>` token inside a JavaScript-generated email/report HTML template. That split executable content and caused raw JavaScript to render in the application.

## Recovery design
- Fresh V12.10.11 source
- CSS-only premium corporate theme
- No runtime patch JavaScript
- Event Workspace uses UnitedBML navy/cyan/teal
- AP batch metrics use boxed KPI cards
- Login screen uses the same corporate brand system
- Status pills standardized through existing V12 classes

## Integrity validation
- PASS — Script block count unchanged — 7
- PASS — Every script block byte-identical
- PASS — Static IDs unchanged
- PASS — onclick handlers unchanged
- PASS — onchange handlers unchanged
- PASS — onsubmit handlers unchanged
- PASS — oninput handlers unchanged
- PASS — onload handlers unchanged
- PASS — onerror handlers unchanged
- PASS — Theme removal restores exact baseline
- PASS — All inline JavaScript valid — []

No SQL migration is required.
