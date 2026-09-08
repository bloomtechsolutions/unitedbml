# UnitedBML V12.5.1 Logo Fix

The logo PNG inside the package is valid.

Changes:
- uses relative `./assets/unitedbml-logo.png` paths
- adds an embedded PNG fallback if the static asset fails to load
- covers login, animated loading state, sidebar and external approval branding
- constrains logo sizing so fallback rendering stays clean

No database migration is required.
