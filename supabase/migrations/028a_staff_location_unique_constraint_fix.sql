-- UnitedBML V12.9.3
-- Fix Location Classification save error:
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification"

-- The earlier expression index:
--   (match_type, lower(match_value))
-- cannot be used by PostgREST on_conflict=match_type,match_value.
--
-- Add a real two-column unique constraint.

-- Normalize obvious whitespace first.
update public.staff_location_classification
set match_value=trim(match_value)
where match_value<>trim(match_value);

-- Remove exact duplicate rows if any somehow exist, retaining the most recent.
delete from public.staff_location_classification a
using public.staff_location_classification b
where a.match_type=b.match_type
  and a.match_value=b.match_value
  and (
    a.updated_at < b.updated_at
    or (a.updated_at=b.updated_at and a.id::text < b.id::text)
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.staff_location_classification'::regclass
      and conname='staff_location_classification_match_unique'
  ) then
    alter table public.staff_location_classification
      add constraint staff_location_classification_match_unique
      unique(match_type,match_value);
  end if;
end $$;

-- Keep the lower-case index as an additional guard/search accelerator.
create unique index if not exists staff_location_classification_unique
on public.staff_location_classification(match_type,lower(match_value));
