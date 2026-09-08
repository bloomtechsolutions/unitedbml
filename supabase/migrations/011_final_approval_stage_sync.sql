-- UnitedBML final approval stage synchronization
-- Enables realtime UPDATE notifications for expense_requests.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='expense_requests'
  ) then
    alter publication supabase_realtime add table public.expense_requests;
  end if;
end $$;
