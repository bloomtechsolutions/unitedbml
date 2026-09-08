-- UnitedBML Vendor Master for Accounts Payable vendor selection
create table if not exists public.vendor_master (
  vendor_account text primary key,
  name text not null,
  worker_id text,
  status text not null default 'Active' check (status in ('Active','Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ap_bills
  add column if not exists worker_id text;

insert into public.vendor_master (vendor_account,name,worker_id,status)
values
  ('V01111','Mohamed Shaig Ahmed','1892','Active'),
  ('V02222','Nahula','8555','Active'),
  ('V03333','Hussain Alu','3333','Active')
on conflict (vendor_account) do update
set name=excluded.name,
    worker_id=excluded.worker_id,
    status=excluded.status,
    updated_at=now();

alter table public.vendor_master enable row level security;

drop policy if exists vendor_master_read_authenticated on public.vendor_master;
drop policy if exists vendor_master_manage_authorized on public.vendor_master;
drop policy if exists vendor_master_insert_authorized on public.vendor_master;
drop policy if exists vendor_master_update_authorized on public.vendor_master;
drop policy if exists vendor_master_delete_authorized on public.vendor_master;

create policy vendor_master_read_authenticated
on public.vendor_master for select
to authenticated
using (true);

create policy vendor_master_insert_authorized
on public.vendor_master for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id=auth.uid()
      and lower(coalesce(p.role,'')) in ('treasurer','president','chairperson','vice chairperson','vice_chairperson','secretary')
      and coalesce(p.status,'Active') <> 'Inactive'
  )
);

create policy vendor_master_update_authorized
on public.vendor_master for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=auth.uid()
      and lower(coalesce(p.role,'')) in ('treasurer','president','chairperson','vice chairperson','vice_chairperson','secretary')
      and coalesce(p.status,'Active') <> 'Inactive'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id=auth.uid()
      and lower(coalesce(p.role,'')) in ('treasurer','president','chairperson','vice chairperson','vice_chairperson','secretary')
      and coalesce(p.status,'Active') <> 'Inactive'
  )
);

create policy vendor_master_delete_authorized
on public.vendor_master for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=auth.uid()
      and lower(coalesce(p.role,'')) in ('treasurer','president','chairperson','vice chairperson','vice_chairperson','secretary')
      and coalesce(p.status,'Active') <> 'Inactive'
  )
);
