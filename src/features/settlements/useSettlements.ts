import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  ApBatchRow,
  ApBillRow,
  ContingencyRequestRow,
  EventActualExpenseRow,
  EventRow,
  ExpenseLineRow,
  ExpenseRequestRow,
  ReimbursementCaseRow,
} from '../../types/database';
import { CONTINGENCY_ACTIVE_STATUSES, type ReconciliationLine, type SettlementRow } from './types';

export function settlementKeyForEvent(eventId: string): string {
  return eventId;
}
export function settlementKeyForRequest(expenseRequestId: string): string {
  return `REQ:${expenseRequestId}`;
}
export function isGeneralSettlementKey(key: string): boolean {
  return key.startsWith('REQ:');
}
export function requestIdFromKey(key: string): string | null {
  return isGeneralSettlementKey(key) ? key.slice(4) : null;
}

/** True when an approved request has no usable event link — the legacy build's
 * isGeneralExpenseRequest() heuristic, simplified: our event_id FK is ON DELETE SET NULL,
 * so an orphaned reference can't happen here — a null event_id is the only case. */
function isGeneralExpenseRequest(r: Pick<ExpenseRequestRow, 'event_id'>): boolean {
  return !r.event_id;
}

interface RawData {
  events: EventRow[];
  requests: ExpenseRequestRow[];
  lines: ExpenseLineRow[];
  contingency: ContingencyRequestRow[];
  reimbursementCases: ReimbursementCaseRow[];
  apBatches: ApBatchRow[];
  apBills: ApBillRow[];
}

function useRawSettlementData() {
  const [data, setData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [events, requests, lines, contingency, reimbursementCases, apBatches, apBills] = await Promise.all([
      supabase.from('events').select('*'),
      supabase.from('expense_requests').select('*'),
      supabase.from('expense_lines').select('*'),
      supabase.from('contingency_requests').select('*').order('requested_at', { ascending: false }),
      supabase.from('reimbursement_cases').select('*'),
      supabase.from('ap_batches').select('*'),
      supabase.from('ap_bills').select('*'),
    ]);
    const firstError =
      events.error || requests.error || lines.error || contingency.error || reimbursementCases.error || apBatches.error || apBills.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setData({
      events: events.data ?? [],
      requests: requests.data ?? [],
      lines: lines.data ?? [],
      contingency: contingency.data ?? [],
      reimbursementCases: reimbursementCases.data ?? [],
      apBatches: apBatches.data ?? [],
      apBills: apBills.data ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

// ---- Contingency math (ports of the legacy build's contingency helper functions) ----

export function contingencyApprovedRequests(contingency: ContingencyRequestRow[]): ContingencyRequestRow[] {
  return contingency.filter((c) => c.status === 'Approved' && Number(c.released_amount || 0) > 0);
}

export function contingencyApprovedForLine(contingency: ContingencyRequestRow[], requestId: string, lineIndex: number): number {
  return contingencyApprovedRequests(contingency)
    .filter((c) => c.expense_request_id === requestId && c.line_index === lineIndex)
    .reduce((sum, c) => sum + Number(c.released_amount || 0), 0);
}

export function contingencyAllocatedForRequest(contingency: ContingencyRequestRow[], requestId: string): number {
  return contingencyApprovedRequests(contingency)
    .filter((c) => c.expense_request_id === requestId)
    .reduce((sum, c) => sum + Number(c.released_amount || 0), 0);
}

export function contingencyAvailableForRequest(contingency: ContingencyRequestRow[], request: ExpenseRequestRow): number {
  return Math.max(0, Number(request.contingency_amount || 0) - contingencyAllocatedForRequest(contingency, request.id));
}

export function contingencyRequestsForEntity(contingency: ContingencyRequestRow[], key: string): ContingencyRequestRow[] {
  const requestId = requestIdFromKey(key);
  return requestId ? contingency.filter((c) => c.expense_request_id === requestId) : contingency.filter((c) => c.event_id === key);
}

// ---- Register (list of settlement rows) ----

export function useSettlementRegister() {
  const { data, loading, error, reload } = useRawSettlementData();

  const rows = useMemo<SettlementRow[]>(() => {
    if (!data) return [];
    const out: SettlementRow[] = [];

    const eventBudget = (eventId: string) =>
      data.requests.filter((r) => r.event_id === eventId && r.status === 'Approved').reduce((s, r) => s + (r.total_amount || 0), 0);

    for (const event of data.events) {
      const approved = eventBudget(event.id);
      if (approved <= 0) continue;
      const contingencyForEvent = data.contingency.filter((c) => c.event_id === event.id);
      out.push({
        key: event.id,
        isGeneral: false,
        reference: `SET-${event.id}`,
        title: event.name,
        eventId: event.id,
        eventName: event.name,
        requestIds: data.requests.filter((r) => r.event_id === event.id && r.status === 'Approved').map((r) => r.id),
        date: event.event_date,
        approved,
        actual: event.actual_expense_total || 0,
        status: event.finance_settlement_status || 'Pending Actuals',
        contingencyReleased: contingencyForEvent
          .filter((c) => c.status === 'Approved')
          .reduce((s, c) => s + Number(c.released_amount || 0), 0),
        pendingContingency: contingencyForEvent.filter((c) => CONTINGENCY_ACTIVE_STATUSES.includes(c.status)).length,
        reimbursementPendingCount: 0,
      });
    }

    for (const request of data.requests) {
      if (request.status !== 'Approved' || !isGeneralExpenseRequest(request)) continue;
      const key = settlementKeyForRequest(request.id);
      const contingencyForRequest = data.contingency.filter((c) => c.expense_request_id === request.id);
      out.push({
        key,
        isGeneral: true,
        reference: `SET-${request.request_number ?? request.id}`,
        title: request.title || request.request_number || 'General Expense',
        eventId: null,
        eventName: null,
        requestIds: [request.id],
        date: request.request_date,
        approved: request.total_amount || 0,
        actual: request.actual_expense_total || 0,
        status: request.finance_settlement_status || 'Pending Actuals',
        contingencyReleased: contingencyForRequest
          .filter((c) => c.status === 'Approved')
          .reduce((s, c) => s + Number(c.released_amount || 0), 0),
        pendingContingency: contingencyForRequest.filter((c) => CONTINGENCY_ACTIVE_STATUSES.includes(c.status)).length,
        reimbursementPendingCount: 0,
      });
    }

    return out.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [data]);

  return {
    rows,
    loading,
    error,
    reload,
  };
}

// ---- Detail (per-line reconciliation for one settlement) ----

function reimbursementActualForLine(
  cases: ReimbursementCaseRow[],
  batches: ApBatchRow[],
  bills: ApBillRow[],
  expenseRequestId: string,
  lineIndex: number
): { amount: number; settled: boolean; detail: string } {
  const lineCases = cases.filter(
    (c) => c.expense_request_id === expenseRequestId && c.expense_line_no === lineIndex && c.status !== 'Rejected' && !c.data?.isProcurementGroup
  );
  if (!lineCases.length) return { amount: 0, settled: false, detail: '' };

  const caseIds = lineCases.map((c) => c.id);
  const activeBatches = batches.filter((b) => caseIds.includes(b.reimbursement_id) && b.status !== 'Cancelled');
  const paidBatches = activeBatches.filter((b) => b.status === 'Paid');
  const amount = bills.filter((bill) => paidBatches.some((b) => b.id === bill.ap_batch_id)).reduce((s, bill) => s + Number(bill.amount || 0), 0);
  const settled = activeBatches.length > 0 && activeBatches.every((b) => b.status === 'Paid');
  const detail = activeBatches.length
    ? `${activeBatches.length} AP batch(es) · ${paidBatches.length} paid`
    : 'Awaiting AP submission';
  return { amount, settled, detail };
}

export function useSettlementDetail(key: string | null) {
  const { data, loading, error, reload } = useRawSettlementData();
  const [actuals, setActuals] = useState<EventActualExpenseRow[]>([]);
  const [actualsLoading, setActualsLoading] = useState(true);

  const reloadActuals = useCallback(async () => {
    if (!key) return;
    setActualsLoading(true);
    const { data: rows } = await supabase.from('event_actual_expenses').select('*').eq('settlement_key', key);
    setActuals(rows ?? []);
    setActualsLoading(false);
  }, [key]);

  useEffect(() => {
    void reloadActuals();
  }, [reloadActuals]);

  const lines = useMemo<ReconciliationLine[]>(() => {
    if (!data || !key) return [];
    const isGeneral = isGeneralSettlementKey(key);
    const requestId = requestIdFromKey(key);
    const scopedRequests = isGeneral
      ? data.requests.filter((r) => r.id === requestId && r.status === 'Approved')
      : data.requests.filter((r) => r.event_id === key && r.status === 'Approved');

    const out: ReconciliationLine[] = [];
    for (const request of scopedRequests) {
      const reqLines = data.lines.filter((l) => l.expense_request_id === request.id).sort((a, b) => a.line_no - b.line_no);
      for (const line of reqLines) {
        const sourceKey = `${request.id}:${line.line_no}`;
        const contingencyAdded = contingencyApprovedForLine(data.contingency, request.id, line.line_no);
        const approvedAmount = (line.line_total || 0) + contingencyAdded;
        const saved = actuals.find((a) => a.source_key === sourceKey);
        if (line.reimbursement_required) {
          const reimb = reimbursementActualForLine(data.reimbursementCases, data.apBatches, data.apBills, request.id, line.line_no);
          out.push({
            sourceKey,
            expenseRequestId: request.id,
            expenseRequestNumber: request.request_number,
            lineIndex: line.line_no,
            expenseItem: line.description,
            originalApprovedAmount: line.line_total || 0,
            contingencyAdded,
            approvedAmount,
            reimbursementRequired: true,
            isContingency: false,
            sourceType: 'Reimbursement',
            actualAmount: reimb.amount,
            manualEntered: true,
            settled: reimb.settled,
            reimbursementDetail: reimb.detail,
          });
        } else {
          out.push({
            sourceKey,
            expenseRequestId: request.id,
            expenseRequestNumber: request.request_number,
            lineIndex: line.line_no,
            expenseItem: line.description,
            originalApprovedAmount: line.line_total || 0,
            contingencyAdded,
            approvedAmount,
            reimbursementRequired: false,
            isContingency: false,
            sourceType: 'Direct Entry',
            actualAmount: saved ? saved.actual_amount : 0,
            manualEntered: !!saved,
            settled: !!saved,
          });
        }
      }
      if (Number(request.contingency_amount || 0) > 0) {
        const available = contingencyAvailableForRequest(data.contingency, request);
        out.push({
          sourceKey: `${request.id}:CONTINGENCY`,
          expenseRequestId: request.id,
          expenseRequestNumber: request.request_number,
          lineIndex: -1,
          expenseItem: 'Contingency (5%) Reserve',
          originalApprovedAmount: Number(request.contingency_amount || 0),
          contingencyAdded: 0,
          approvedAmount: available,
          reimbursementRequired: false,
          isContingency: true,
          sourceType: 'Reserve',
          actualAmount: 0,
          manualEntered: true,
          settled: true,
        });
      }
    }
    return out;
  }, [data, key, actuals]);

  const entity = useMemo(() => {
    if (!data || !key) return null;
    if (isGeneralSettlementKey(key)) {
      const requestId = requestIdFromKey(key)!;
      return data.requests.find((r) => r.id === requestId) ?? null;
    }
    return data.events.find((e) => e.id === key) ?? null;
  }, [data, key]);

  const contingencyRequests = useMemo(() => (key && data ? contingencyRequestsForEntity(data.contingency, key) : []), [data, key]);

  return {
    entity,
    lines,
    contingencyRequests,
    contingencyAll: data?.contingency ?? [],
    requests: data?.requests ?? [],
    loading: loading || actualsLoading,
    error,
    reload: async () => Promise.all([reload(), reloadActuals()]),
  };
}

export async function saveSettlementActuals(
  settlementKey: string,
  lines: { sourceKey: string; expenseRequestId: string; lineIndex: number; expenseItem: string; approvedAmount: number; actualAmount: number; sourceType: string; manualEntered: boolean }[],
  remarks: string
) {
  const { data, error } = await supabase.rpc('save_settlement_actuals', {
    p_settlement_key: settlementKey,
    p_lines: lines,
    p_remarks: remarks || null,
  });
  if (error) throw error;
  return data as { ok: boolean; total: number };
}

export async function closeSettlement(settlementKey: string) {
  const { error } = await supabase.rpc('close_settlement', { p_settlement_key: settlementKey });
  if (error) throw error;
}

// ---- Contingency workflow ----

export async function createContingencyRequest(payload: {
  eventId: string | null;
  eventName: string | null;
  expenseRequestId: string;
  expenseRequestNumber: string | null;
  lineIndex: number;
  expenseItem: string;
  originalApprovedAmount: number;
  requestedAmount: number;
  reason: string;
  requestedByName: string;
  requestedByRole: string;
  requestedByEmail: string;
  requestedById: string;
}) {
  const ref = `CTR-${Date.now().toString(36).toUpperCase()}`;
  const { error } = await supabase.from('contingency_requests').insert({
    ref,
    event_id: payload.eventId,
    event_name: payload.eventName,
    expense_request_id: payload.expenseRequestId,
    expense_request_number: payload.expenseRequestNumber,
    line_index: payload.lineIndex,
    expense_item: payload.expenseItem,
    original_approved_amount: payload.originalApprovedAmount,
    requested_amount: payload.requestedAmount,
    reason: payload.reason,
    status: 'Pending President Recommendation',
    requested_by: payload.requestedById || null,
    requested_by_name: payload.requestedByName,
    requested_by_role: payload.requestedByRole,
    requested_by_email: payload.requestedByEmail,
  } satisfies Partial<ContingencyRequestRow>);
  if (error) throw error;
}

export async function recommendContingency(request: ContingencyRequestRow, decision: 'Approve' | 'Reject', comment: string, actorName: string) {
  const { error } = await supabase
    .from('contingency_requests')
    .update({
      status: decision === 'Approve' ? 'Pending Procurement Pre-Approval' : 'Rejected',
      president_recommendation: decision === 'Approve' ? 'Recommended' : `Rejected: ${comment}`,
      president_by: actorName,
      president_at: new Date().toISOString(),
    })
    .eq('id', request.id);
  if (error) throw error;
}

export async function markContingencyProcurementSent(request: ContingencyRequestRow, to: string, subject: string) {
  const { error } = await supabase
    .from('contingency_requests')
    .update({
      status: 'Awaiting Procurement Response',
      procurement_to: to,
      procurement_subject: subject,
      procurement_email_sent_at: new Date().toISOString(),
    })
    .eq('id', request.id);
  if (error) throw error;
}

export async function decideContingencyProcurement(
  request: ContingencyRequestRow,
  decision: 'Approved' | 'Rejected',
  releasedAmount: number,
  responseBy: string
) {
  const { error } = await supabase
    .from('contingency_requests')
    .update({
      status: decision,
      procurement_decision: decision,
      procurement_response_date: new Date().toISOString().slice(0, 10),
      procurement_response_by: responseBy,
      released_amount: decision === 'Approved' ? releasedAmount : 0,
      released_at: decision === 'Approved' ? new Date().toISOString() : null,
      released_by: decision === 'Approved' ? responseBy : null,
    })
    .eq('id', request.id);
  if (error) throw error;
}

export function useContingencyRequests() {
  const [requests, setRequests] = useState<ContingencyRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('contingency_requests').select('*').order('requested_at', { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { requests, loading, reload };
}
