-- UnitedBML V12.9.9
-- Centrally store Procurement response emails/evidence in Supabase Storage.

insert into storage.buckets (
  id,name,public,file_size_limit,allowed_mime_types
)
values (
  'reimbursement-evidence',
  'reimbursement-evidence',
  false,
  15728640,
  array[
    'message/rfc822',
    'application/vnd.ms-outlook',
    'application/octet-stream',
    'application/pdf',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  public=false,
  file_size_limit=15728640,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists reimbursement_evidence_read on storage.objects;
drop policy if exists reimbursement_evidence_insert on storage.objects;
drop policy if exists reimbursement_evidence_update on storage.objects;
drop policy if exists reimbursement_evidence_delete on storage.objects;

create policy reimbursement_evidence_read
on storage.objects
for select
to authenticated
using(bucket_id='reimbursement-evidence');

create policy reimbursement_evidence_insert
on storage.objects
for insert
to authenticated
with check(bucket_id='reimbursement-evidence');

create policy reimbursement_evidence_update
on storage.objects
for update
to authenticated
using(bucket_id='reimbursement-evidence')
with check(bucket_id='reimbursement-evidence');

create policy reimbursement_evidence_delete
on storage.objects
for delete
to authenticated
using(bucket_id='reimbursement-evidence');
