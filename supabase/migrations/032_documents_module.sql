-- UnitedBML V12.10
-- Documents module: manual document registry + private document storage.
-- Financial source documents remain linked to their existing storage paths.

create table if not exists public.document_registry (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'GENERAL',
  event_id text,
  event_name text,
  source_module text not null default 'DOCUMENTS',
  source_record_id text,
  file_name text not null,
  file_type text,
  file_size bigint not null default 0,
  storage_bucket text not null default 'unitedbml-documents',
  storage_path text not null,
  visibility text not null default 'COMMITTEE',
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists document_registry_event_idx
  on public.document_registry(event_id);

create index if not exists document_registry_category_idx
  on public.document_registry(category);

create index if not exists document_registry_created_idx
  on public.document_registry(created_at desc);

alter table public.document_registry enable row level security;

drop policy if exists document_registry_read on public.document_registry;
drop policy if exists document_registry_write on public.document_registry;

create policy document_registry_read
on public.document_registry
for select to authenticated
using(public.is_committee_user());

create policy document_registry_write
on public.document_registry
for all to authenticated
using(public.is_committee_user())
with check(public.is_committee_user());

insert into storage.buckets (
  id,name,public,file_size_limit,allowed_mime_types
)
values (
  'unitedbml-documents',
  'unitedbml-documents',
  false,
  26214400,
  null
)
on conflict (id) do update set
  public=false,
  file_size_limit=26214400;

drop policy if exists unitedbml_documents_read on storage.objects;
drop policy if exists unitedbml_documents_insert on storage.objects;
drop policy if exists unitedbml_documents_update on storage.objects;
drop policy if exists unitedbml_documents_delete on storage.objects;

create policy unitedbml_documents_read
on storage.objects for select to authenticated
using(bucket_id='unitedbml-documents' and public.is_committee_user());

create policy unitedbml_documents_insert
on storage.objects for insert to authenticated
with check(bucket_id='unitedbml-documents' and public.is_committee_user());

create policy unitedbml_documents_update
on storage.objects for update to authenticated
using(bucket_id='unitedbml-documents' and public.is_committee_user())
with check(bucket_id='unitedbml-documents' and public.is_committee_user());

create policy unitedbml_documents_delete
on storage.objects for delete to authenticated
using(bucket_id='unitedbml-documents' and public.is_committee_user());
