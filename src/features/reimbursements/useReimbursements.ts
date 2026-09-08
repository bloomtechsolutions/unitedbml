import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  ApBatchRow,
  ApBillRow,
  ExpenseLineRow,
  ExpenseRequestRow,
  ReimbursementCaseRow,
  VendorMasterRow,
} from '../../types/database';
import type {
  ApBatchWithBills,
  AttachmentMode,
  EligibleExpenseRequest,
  GroupItem,
  ProcurementGroupCase,
} from './types';
import { apBillEvidencePath, procurementEvidencePath, uploadEvidence } from './storage';

function assembleCases(cases: ReimbursementCaseRow[]): ProcurementGroupCase[] {
  return cases.map((c) => ({ ...c, items: ((c.data?.items as GroupItem[] | undefined) ?? []) }));
}

export function useReimbursementCases() {
  const [cases, setCases] = useState<ProcurementGroupCase[]>([]);
  const [batches, setBatches] = useState<ApBatchWithBills[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [casesRes, batchesRes, billsRes] = await Promise.all([
      supabase.from('reimbursement_cases').select('*').order('created_at', { ascending: false }),
      supabase.from('ap_batches').select('*'),
      supabase.from('ap_bills').select('*'),
    ]);
    const firstError = casesRes.error || batchesRes.error || billsRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setCases(assembleCases(casesRes.data ?? []));
    setBatches(
      (batchesRes.data ?? []).map((b) => ({ ...b, bills: (billsRes.data ?? []).filter((bill) => bill.ap_batch_id === b.id).sort((a, bb) => a.line_no - bb.line_no) }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { cases, batches, loading, error, reload };
}

export function useEligibleExpenseRequests(cases: ReimbursementCaseRow[]) {
  const [eligible, setEligible] = useState<EligibleExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from('expense_requests').select('*').eq('status', 'Approved'),
      supabase.from('expense_lines').select('*').eq('reimbursement_required', true),
    ]).then(([requestsRes, linesRes]) => {
      if (!active) return;
      const requests = (requestsRes.data ?? []) as ExpenseRequestRow[];
      const lines = (linesRes.data ?? []) as ExpenseLineRow[];
      const groupedRequestIds = new Set(
        cases.filter((c) => (c.data?.isProcurementGroup as boolean | undefined) && c.status !== 'Rejected').map((c) => c.expense_request_id)
      );
      const exceptionOrPreApprovedLines = new Set(
        cases.filter((c) => !(c.data?.isProcurementGroup as boolean | undefined) && c.status !== 'Rejected').map((c) => `${c.expense_request_id}:${c.expense_line_no}`)
      );
      const result: EligibleExpenseRequest[] = [];
      for (const req of requests) {
        const reqLines = lines.filter((l) => l.expense_request_id === req.id);
        if (!reqLines.length) continue;
        const outstandingLines = reqLines.filter((l) => !exceptionOrPreApprovedLines.has(`${req.id}:${l.line_no}`));
        if (!outstandingLines.length) continue;
        result.push({
          expenseRequestId: req.id,
          expenseRequestNumber: req.request_number,
          title: req.title,
          eventId: req.event_id,
          eventName: req.event_name,
          lines: outstandingLines.map((l) => ({
            expenseRequestId: req.id,
            expenseRequestNumber: req.request_number,
            eventId: req.event_id,
            eventName: req.event_name,
            lineNo: l.line_no,
            description: l.description,
            amount: l.line_total,
          })),
        });
      }
      setEligible(result.filter((r) => !groupedRequestIds.has(r.expenseRequestId)));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [cases]);

  return { eligible, loading };
}

export async function createProcurementGroup(
  request: EligibleExpenseRequest,
  managerEmail: string,
  headEmail: string,
  requestedBy: string
) {
  const id = crypto.randomUUID();
  const ref = `PRC-${Date.now().toString(36).toUpperCase()}`;
  const totalAmount = request.lines.reduce((sum, l) => sum + l.amount, 0);
  const { error } = await supabase.from('reimbursement_cases').insert({
    id,
    case_ref: ref,
    expense_request_id: request.expenseRequestId,
    expense_request_number: request.expenseRequestNumber,
    event_id: request.eventId,
    event_name: request.eventName,
    expense_item: `${request.lines.length} item(s)`,
    approved_item_amount: totalAmount,
    route: 'Standard',
    status: 'Awaiting Procurement Response',
    requested_by: requestedBy,
    procurement_manager_email: managerEmail,
    procurement_head_email: headEmail,
    email_reference: ref,
    email_prepared_at: new Date().toISOString(),
    data: {
      isProcurementGroup: true,
      items: request.lines.map((l) => ({ lineNo: l.lineNo, description: l.description, amount: l.amount })),
    },
  } satisfies Partial<ReimbursementCaseRow>);
  if (error) throw error;
  return id;
}

export async function recordProcurementResponse(
  group: ProcurementGroupCase,
  decision: 'Approved' | 'Rejected',
  comment: string,
  respondedBy: string,
  evidenceFile: File | null
) {
  let evidencePath: string | null = null;
  if (evidenceFile) {
    evidencePath = procurementEvidencePath(group.id, evidenceFile.name);
    await uploadEvidence(evidencePath, evidenceFile);
  }

  const { error } = await supabase
    .from('reimbursement_cases')
    .update({
      status: decision,
      procurement_comment: comment || null,
      procurement_response_by: respondedBy,
      procurement_response_date: new Date().toISOString().slice(0, 10),
      data: { ...group.data, evidencePath: evidencePath ?? (group.data as { evidencePath?: string }).evidencePath },
    })
    .eq('id', group.id);
  if (error) throw error;

  await supabase.from('reimbursement_history').insert({
    reimbursement_id: group.id,
    action: 'procurement_response',
    status: decision,
    remarks: comment || null,
    actor_name: respondedBy,
  });

  if (decision === 'Approved') {
    for (const item of group.items) {
      const lineId = crypto.randomUUID();
      const { error: lineError } = await supabase.from('reimbursement_cases').insert({
        id: lineId,
        case_ref: `${group.case_ref}-${String(item.lineNo).padStart(2, '0')}`,
        expense_request_id: group.expense_request_id,
        expense_request_number: group.expense_request_number,
        expense_line_no: item.lineNo,
        event_id: group.event_id,
        event_name: group.event_name,
        expense_item: item.description,
        approved_item_amount: item.amount,
        route: 'Standard',
        status: 'Pre-Approved',
        requested_by: group.requested_by,
        procurement_manager_email: group.procurement_manager_email,
        procurement_head_email: group.procurement_head_email,
        procurement_comment: comment || null,
        procurement_response_by: respondedBy,
        procurement_response_date: new Date().toISOString().slice(0, 10),
        data: { groupId: group.id, evidencePath },
      } satisfies Partial<ReimbursementCaseRow>);
      if (lineError) throw lineError;
    }
  }
}

export async function recordException(
  request: { expenseRequestId: string; expenseRequestNumber: string | null; eventId: string | null; eventName: string | null },
  line: { lineNo: number; description: string; amount: number },
  reason: string,
  remarks: string,
  expectedDate: string,
  recordedBy: string
) {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('reimbursement_cases').insert({
    id,
    case_ref: `EXC-${Date.now().toString(36).toUpperCase()}`,
    expense_request_id: request.expenseRequestId,
    expense_request_number: request.expenseRequestNumber,
    expense_line_no: line.lineNo,
    event_id: request.eventId,
    event_name: request.eventName,
    expense_item: line.description,
    approved_item_amount: line.amount,
    route: 'Exception',
    status: 'Exception Recorded',
    exception_reason: reason,
    exception_remarks: remarks || null,
    exception_expense_date: expectedDate || null,
    recorded_by: recordedBy,
    recorded_at: new Date().toISOString(),
  } satisfies Partial<ReimbursementCaseRow>);
  if (error) throw error;
  return id;
}

export function apSubmittedTotal(batches: ApBatchWithBills[], caseId: string): number {
  return batches
    .filter((b) => b.reimbursement_id === caseId && b.status !== 'Draft' && b.status !== 'Cancelled')
    .reduce((sum, b) => sum + b.bills.reduce((s, bill) => s + bill.amount, 0), 0);
}

export function apPaidTotal(batches: ApBatchWithBills[], caseId: string): number {
  return batches
    .filter((b) => b.reimbursement_id === caseId && b.status === 'Paid')
    .reduce((sum, b) => sum + b.bills.reduce((s, bill) => s + bill.amount, 0), 0);
}

export async function saveApBatchDraft(
  batchId: string | null,
  caseId: string,
  bills: Omit<ApBillRow, 'id' | 'ap_batch_id'>[],
  apEmail: string
) {
  const id = batchId ?? crypto.randomUUID();
  if (!batchId) {
    const { error } = await supabase.from('ap_batches').insert({
      id,
      reimbursement_id: caseId,
      submission_ref: `AP-${Date.now().toString(36).toUpperCase()}`,
      submission_date: new Date().toISOString().slice(0, 10),
      status: 'Draft',
      ap_email: apEmail || null,
    } satisfies Partial<ApBatchRow>);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('ap_batches').update({ ap_email: apEmail || null }).eq('id', id);
    if (error) throw error;
  }

  await supabase.from('ap_bills').delete().eq('ap_batch_id', id);
  if (bills.length) {
    const { error: billsError } = await supabase.from('ap_bills').insert(
      bills.map((b, i) => ({ ...b, ap_batch_id: id, line_no: i + 1 }))
    );
    if (billsError) throw billsError;
  }
  return id;
}

export async function uploadBatchAttachment(batchId: string, mode: AttachmentMode, file: File, billKey?: string) {
  const path = apBillEvidencePath(batchId, billKey ?? 'combined', file.name);
  await uploadEvidence(path, file);
  if (mode === 'Combined') {
    const { error } = await supabase
      .from('ap_batches')
      .update({ bills_attachment_name: file.name, bills_attachment_type: file.type, bills_attachment_stored: true, bills_attachment_path: path })
      .eq('id', batchId);
    if (error) throw error;
  }
  return path;
}

export async function sendApBatch(batch: ApBatchWithBills, attachmentMode: AttachmentMode) {
  // Single-send protection: re-check the current status right before flipping it, so a
  // duplicate/racing click on a stale in-memory batch can't send twice.
  const { data: current, error: fetchError } = await supabase.from('ap_batches').select('status').eq('id', batch.id).single();
  if (fetchError) throw fetchError;
  if (current.status !== 'Draft') {
    throw new Error('This batch has already been sent.');
  }
  if (!batch.ap_email) throw new Error('An AP email address is required before sending.');
  if (!batch.bills.length) throw new Error('Add at least one bill before sending.');
  for (const bill of batch.bills) {
    if (!bill.vendor_number || !bill.bill_date || !(bill.amount > 0)) {
      throw new Error('Every bill needs a vendor, date, and amount before sending.');
    }
    if (attachmentMode === 'Individual' && !(bill.data as { attachmentPath?: string })?.attachmentPath) {
      throw new Error('Every bill needs its own attachment in Individual mode.');
    }
  }
  if (attachmentMode === 'Combined' && !batch.bills_attachment_path) {
    throw new Error('Upload a combined bills attachment before sending.');
  }

  const { error } = await supabase
    .from('ap_batches')
    .update({ status: 'Sent to AP', sent_at: new Date().toISOString() })
    .eq('id', batch.id);
  if (error) throw error;

  await supabase.from('reimbursement_history').insert({
    reimbursement_id: batch.reimbursement_id,
    action: 'ap_batch_sent',
    status: 'Sent to AP',
    remarks: `Batch ${batch.submission_ref} sent to ${batch.ap_email}`,
  });
}

export async function updateApBatchStatus(batch: ApBatchWithBills, status: string, remarks: string, actorName: string) {
  const { error } = await supabase
    .from('ap_batches')
    .update({ status, status_date: new Date().toISOString().slice(0, 10), status_remarks: remarks || null })
    .eq('id', batch.id);
  if (error) throw error;
  await supabase.from('reimbursement_history').insert({
    reimbursement_id: batch.reimbursement_id,
    action: 'ap_status_update',
    status,
    remarks: remarks || null,
    actor_name: actorName,
  });
}

export function useVendorSearch(query: string) {
  const [results, setResults] = useState<VendorMasterRow[]>([]);

  useEffect(() => {
    let active = true;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      supabase
        .from('vendor_master')
        .select('*')
        .neq('status', 'Inactive')
        .or(`name.ilike.%${query}%,vendor_account.ilike.%${query}%,worker_id.ilike.%${query}%`)
        .limit(12)
        .then(({ data }) => {
          if (active) setResults(data ?? []);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  return results;
}
