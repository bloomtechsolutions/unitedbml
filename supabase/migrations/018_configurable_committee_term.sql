-- UnitedBML configurable Committee term.
-- Seeds the current official term once; the app can edit it thereafter.

insert into public.app_settings(setting_key,setting_value,updated_at)
values (
  'clubCommitteeTermV1',
  jsonb_build_object(
    'start','2026-01-01',
    'end','2027-12-31',
    'updatedAt',now()
  ),
  now()
)
on conflict (setting_key) do nothing;
