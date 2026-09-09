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
import { downloadAsAttachment, outlookEmailTemplate, sendEmail, type EmailAttachment } from '../../lib/email';
import { generateApprovedExpenseNotePdf } from '../../lib/expenseNotePdf';

const EVIDENCE_BUCKET = 'reimbursement-evidence';
const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;
const STALE_LOCK_MS = 2 * 60 * 1000;

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
  const items: GroupItem[] = request.lines.map((l) => ({ lineNo: l.lineNo, description: l.description, amount: l.amount }));
  const row: Partial<ReimbursementCaseRow> = {
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
    data: { isProcurementGroup: true, items },
  };
  const { error } = await supabase.from('reimbursement_cases').insert(row);
  if (error) throw error;
  return { ...row, items } as ProcurementGroupCase;
}

/** Sends the grouped Procurement pre-approval email (V12.9.7/V12.9.8) with the Approved
 * Expense Approval Note PDF attached, and records the send on the case for audit/inheritance. */
export async function sendProcurementGroupEmail(group: ProcurementGroupCase, actorName: string, actorRole: string, actorEmail: string) {
  if (!group.procurement_manager_email) throw new Error('A Procurement Manager email is required before sending.');

  const total = group.approved_item_amount;
  const advisory =
    group.items.length > 1 || total > 10000 ? 'Please note that any single reimbursement will not exceed MVR 10,000.' : undefined;
  const subject = `Procurement Pre-Approval Required: ${group.case_ref} - ${group.expense_request_number ?? ''}`.trim();

  const note = await generateApprovedExpenseNotePdf(group.expense_request_id!);

  const html = outlookEmailTemplate({
    heading: 'Reimbursement Pre-Approval Request',
    intro: 'Dear Sir, please review the following reimbursement pre-approval request and place it for your approval to proceed.',
    rows: [
      { label: 'Expense Request', value: `${group.expense_request_number ?? ''}` },
      { label: 'Event / Activity', value: group.event_name || 'General (no linked event)' },
    ],
    itemsTable: {
      headers: ['Expense Item', 'Amount (MVR)'],
      rows: group.items.map((i) => [i.description, i.amount.toLocaleString()]),
    },
    totalLabel: 'Total Amount',
    totalValue: `MVR ${total.toLocaleString()}`,
    advisory,
    signatureName: actorName,
    signatureRole: actorRole,
    signatureEmail: actorEmail,
  });

  await sendEmail({
    to: group.procurement_manager_email,
    cc: group.procurement_head_email || undefined,
    subject,
    html,
    attachments: [note],
    emailType: 'Procurement Pre-Approval',
    relatedType: 'reimbursement_case',
    relatedId: group.id,
  });

  const { error } = await supabase
    .from('reimbursement_cases')
    .update({ email_reference: subject, email_sent_at: new Date().toISOString(), email_attachment_name: note.filename })
    .eq('id', group.id);
  if (error) throw error;

  await supabase.from('reimbursement_history').insert({
    reimbursement_id: group.id,
    action: 'procurement_email_sent',
    status: group.status,
    remarks: `Sent to ${group.procurement_manager_email}${group.procurement_head_email ? `, cc ${group.procurement_head_email}` : ''}`,
    actor_name: actorName,
  });
}

export async function recordProcurementResponse(
  group: ProcurementGroupCase,
  decision: 'Approved' | 'Rejected',
  responseDate: string,
  evidenceFile: File | null
) {
  if (evidenceFile && evidenceFile.size > MAX_EVIDENCE_BYTES) {
    throw new Error('Evidence file must be 15 MB or smaller.');
  }
  const respondedBy = [group.procurement_manager_email, group.procurement_head_email].filter(Boolean).join('; ') || 'Procurement';

  let evidencePath: string | null = null;
  if (evidenceFile) {
    evidencePath = procurementEvidencePath(group.id, evidenceFile.name);
    await uploadEvidence(evidencePath, evidenceFile);
  }

  const { error } = await supabase
    .from('reimbursement_cases')
    .update({
      status: decision,
      procurement_response_by: respondedBy,
      procurement_response_date: responseDate || new Date().toISOString().slice(0, 10),
      data: { ...group.data, evidencePath: evidencePath ?? (group.data as { evidencePath?: string }).evidencePath },
    })
    .eq('id', group.id);
  if (error) throw error;

  await supabase.from('reimbursement_history').insert({
    reimbursement_id: group.id,
    action: 'procurement_response',
    status: decision,
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
        procurement_response_by: respondedBy,
        procurement_response_date: responseDate || new Date().toISOString().slice(0, 10),
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

export interface ApBatchHistoryEntry {
  at: string;
  status: string;
  remarks?: string;
  actorName?: string;
}

function batchHistory(batch: Pick<ApBatchRow, 'data'>): ApBatchHistoryEntry[] {
  return (batch.data?.history as ApBatchHistoryEntry[] | undefined) ?? [];
}

export { batchHistory };

/** Sends the AP submission email — Send AP Email + Attachments (V12.9.10/V12.10.3) — bundling the
 * Approved Expense Approval Note, inherited Procurement response evidence, and the bills, with a
 * persistent single-send lock so a duplicate click while the (potentially slow) send is in flight
 * can't fire the email twice. */
export async function sendApBatch(batch: ApBatchWithBills, caseItem: ProcurementGroupCase, attachmentMode: AttachmentMode, actorName: string) {
  const { data: current, error: fetchError } = await supabase.from('ap_batches').select('status,data,sent_at').eq('id', batch.id).single();
  if (fetchError) throw fetchError;
  if (current.status !== 'Draft' || current.sent_at) {
    throw new Error('This batch has already been sent.');
  }
  const lock = current.data?.emailSendingAt as string | undefined;
  if (lock && Date.now() - new Date(lock).getTime() < STALE_LOCK_MS) {
    throw new Error('A send is already in progress for this batch. Please wait a moment and try again.');
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

  const attemptId = crypto.randomUUID();
  const lockedData = { ...current.data, emailSendingAt: new Date().toISOString(), emailSendingBy: actorName, emailSendAttemptId: attemptId };
  const { error: lockError } = await supabase.from('ap_batches').update({ data: lockedData }).eq('id', batch.id);
  if (lockError) throw lockError;

  try {
    const attachments: EmailAttachment[] = [];
    if (caseItem.expense_request_id) {
      attachments.push(await generateApprovedExpenseNotePdf(caseItem.expense_request_id));
    }
    const evidencePath = (caseItem.data as { evidencePath?: string } | null)?.evidencePath;
    if (evidencePath) {
      const name = evidencePath.split('/').pop() || 'procurement-response';
      attachments.push(await downloadAsAttachment(EVIDENCE_BUCKET, evidencePath, name, ''));
    }
    if (attachmentMode === 'Combined' && batch.bills_attachment_path) {
      attachments.push(
        await downloadAsAttachment(EVIDENCE_BUCKET, batch.bills_attachment_path, batch.bills_attachment_name || 'bills', batch.bills_attachment_type || '')
      );
    } else {
      for (const bill of batch.bills) {
        const path = (bill.data as { attachmentPath?: string } | null)?.attachmentPath;
        const name = (bill.data as { attachmentName?: string } | null)?.attachmentName;
        if (path) attachments.push(await downloadAsAttachment(EVIDENCE_BUCKET, path, name || 'bill', ''));
      }
    }

    const html = outlookEmailTemplate({
      heading: 'Accounts Payable Submission',
      intro: `Please find attached the approved bill(s) for ${caseItem.expense_item} for processing and payment.`,
      rows: [
        { label: 'Submission Reference', value: batch.submission_ref ?? '' },
        { label: 'Reimbursement Case', value: caseItem.case_ref ?? '' },
        { label: 'Event / Activity', value: caseItem.event_name || 'General (no linked event)' },
      ],
      itemsTable: {
        headers: ['Vendor', 'Bill Date', 'Amount (MVR)'],
        rows: batch.bills.map((b) => [b.vendor_name ?? '', b.bill_date ?? '', Number(b.amount ?? 0).toLocaleString()]),
      },
      totalLabel: 'Total Amount',
      totalValue: `MVR ${batch.bills.reduce((s, b) => s + Number(b.amount ?? 0), 0).toLocaleString()}`,
      signatureName: actorName,
      signatureRole: 'Treasurer',
      signatureEmail: '',
    });

    const result = await sendEmail({
      to: batch.ap_email,
      subject: `AP Submission: ${batch.submission_ref} - ${caseItem.expense_item}`,
      html,
      attachments,
      emailType: 'AP Submission',
      relatedType: 'ap_batch',
      relatedId: batch.id,
    });

    const { error } = await supabase
      .from('ap_batches')
      .update({
        status: 'Sent to AP',
        sent_at: new Date().toISOString(),
        data: {
          ...lockedData,
          emailSendingAt: null,
          emailSendingBy: null,
          providerMessageId: result.messageId,
          history: [...batchHistory({ data: lockedData }), { at: new Date().toISOString(), status: 'Sent to AP', actorName, remarks: `Sent to ${batch.ap_email}` }],
        },
      })
      .eq('id', batch.id);
    if (error) throw error;

    await supabase.from('reimbursement_history').insert({
      reimbursement_id: batch.reimbursement_id,
      action: 'ap_batch_sent',
      status: 'Sent to AP',
      remarks: `Batch ${batch.submission_ref} sent to ${batch.ap_email}`,
      actor_name: actorName,
    });
  } catch (err) {
    await supabase
      .from('ap_batches')
      .update({ data: { ...lockedData, emailSendingAt: null, emailSendingBy: null } })
      .eq('id', batch.id);
    throw err;
  }
}

export async function updateApBatchStatus(batch: ApBatchWithBills, status: string, remarks: string, actorName: string) {
  const history = [...batchHistory(batch), { at: new Date().toISOString(), status, remarks: remarks || undefined, actorName }];
  const { error } = await supabase
    .from('ap_batches')
    .update({ status, status_date: new Date().toISOString().slice(0, 10), status_remarks: remarks || null, data: { ...batch.data, history } })
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
