import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { evidenceUrl } from '../reimbursements/storage';
import type { DocumentRegistryRow } from '../../types/database';
import { documentSignedUrl, removeDocumentFile, uploadDocumentFile } from './storage';
import type { VirtualDocument } from './types';

export function useDocumentRegistry() {
  const [documents, setDocuments] = useState<DocumentRegistryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('document_registry')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setDocuments(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { documents, loading, error, reload };
}

export function useEventOptions() {
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase
      .from('events')
      .select('id,name')
      .eq('archived', false)
      .order('name', { ascending: true })
      .then(({ data }) => setEvents(data ?? []));
  }, []);

  return events;
}

export async function uploadDocument(
  payload: { title: string; category: string; eventId: string | null; eventName: string | null; notes: string },
  file: File,
  uploadedBy: { id: string; name: string }
) {
  const { path } = await uploadDocumentFile(payload.eventId, file);
  const { error } = await supabase.from('document_registry').insert({
    title: payload.title,
    category: payload.category,
    event_id: payload.eventId,
    event_name: payload.eventName,
    file_name: file.name,
    file_type: file.type || null,
    file_size: file.size,
    storage_path: path,
    notes: payload.notes || null,
    uploaded_by: uploadedBy.id,
    uploaded_by_name: uploadedBy.name,
  });
  if (error) {
    // Rollback-safety: don't leave an orphaned storage object if the DB insert fails.
    await removeDocumentFile(path).catch(() => undefined);
    throw error;
  }
}

export async function deleteDocument(doc: DocumentRegistryRow) {
  await removeDocumentFile(doc.storage_path);
  const { error } = await supabase.from('document_registry').delete().eq('id', doc.id);
  if (error) throw error;
}

export async function openDocument(bucket: string, path: string): Promise<string | null> {
  if (bucket === 'unitedbml-documents') return documentSignedUrl(path);
  return evidenceUrl(path);
}

/**
 * Read-only aggregation of Procurement/AP evidence already stored by the Reimbursements module —
 * mirrors the legacy documentsVirtualRecords() concept of surfacing other modules' files here
 * without copying them, rather than re-implementing storage for them.
 */
export function useLinkedEvidence() {
  const [items, setItems] = useState<VirtualDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('reimbursement_cases').select('id,case_ref,event_id,event_name,data,created_at'),
      supabase.from('ap_batches').select('id,submission_ref,bills_attachment_name,bills_attachment_path,created_at,reimbursement_id'),
      supabase.from('ap_bills').select('id,ap_batch_id,vendor_name,data'),
    ]).then(([casesRes, batchesRes, billsRes]) => {
      if (!active) return;
      const cases = casesRes.data ?? [];
      const batches = batchesRes.data ?? [];
      const bills = billsRes.data ?? [];
      const caseById = new Map(cases.map((c) => [c.id, c] as const));

      const result: VirtualDocument[] = [];

      for (const c of cases) {
        const evidencePath = (c.data as { evidencePath?: string } | null)?.evidencePath;
        if (evidencePath) {
          result.push({
            key: `procurement-${c.id}`,
            kind: 'PROCUREMENT_EVIDENCE',
            title: `Procurement response — ${c.case_ref}`,
            category: 'PROCUREMENT',
            eventId: c.event_id,
            eventName: c.event_name,
            fileName: evidencePath.split('/').pop() ?? evidencePath,
            createdAt: c.created_at,
            uploadedByName: null,
            registryId: null,
            bucket: 'reimbursement-evidence',
            path: evidencePath,
          });
        }
      }

      for (const b of batches) {
        if (b.bills_attachment_path) {
          const parentCase = caseById.get(b.reimbursement_id);
          result.push({
            key: `ap-combined-${b.id}`,
            kind: 'AP_BILLS_EVIDENCE',
            title: `AP batch — ${b.submission_ref}`,
            category: 'BILLS',
            eventId: parentCase?.event_id ?? null,
            eventName: parentCase?.event_name ?? null,
            fileName: b.bills_attachment_name ?? 'attachment',
            createdAt: b.created_at,
            uploadedByName: null,
            registryId: null,
            bucket: 'reimbursement-evidence',
            path: b.bills_attachment_path,
          });
        }
      }

      const batchById = new Map(batches.map((b) => [b.id, b] as const));
      for (const bill of bills) {
        const path = (bill.data as { attachmentPath?: string; attachmentName?: string } | null)?.attachmentPath;
        if (!path) continue;
        const batch = batchById.get(bill.ap_batch_id);
        const parentCase = batch ? caseById.get(batch.reimbursement_id) : null;
        result.push({
          key: `ap-bill-${bill.id}`,
          kind: 'AP_BILLS_EVIDENCE',
          title: `Bill — ${bill.vendor_name ?? 'Vendor'}`,
          category: 'BILLS',
          eventId: parentCase?.event_id ?? null,
          eventName: parentCase?.event_name ?? null,
          fileName: (bill.data as { attachmentName?: string } | null)?.attachmentName ?? 'attachment',
          createdAt: batch?.created_at ?? '',
          uploadedByName: null,
          registryId: null,
          bucket: 'reimbursement-evidence',
          path,
        });
      }

      result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setItems(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { items, loading };
}
