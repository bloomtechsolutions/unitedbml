import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import type { BudgetRow, ExpenseLineRow, ExpenseReversalRow } from '../../types/database';
import type { FinanceStatus } from '../events/lifecycle';
import type { DraftLine, ExpenseRequestWithLines } from './types';

function currentBudgetYear(): number {
  return new Date().getFullYear();
}

export function useBudget() {
  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('budgets').select('*').eq('budget_year', currentBudgetYear()).maybeSingle();
    setBudget(data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { budget, loading, reload };
}

export async function saveBudget(payload: Partial<BudgetRow>) {
  const { error } = await supabase
    .from('budgets')
    .upsert({ ...payload, budget_year: currentBudgetYear() }, { onConflict: 'budget_year' });
  if (error) throw error;
}

function assemble(requests: ExpenseRequestWithLines[], lines: ExpenseLineRow[]): ExpenseRequestWithLines[] {
  return requests.map((r) => ({ ...r, lines: lines.filter((l) => l.expense_request_id === r.id).sort((a, b) => a.line_no - b.line_no) }));
}

export function useExpenseRequests() {
  const [requests, setRequests] = useState<ExpenseRequestWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [requestsRes, linesRes] = await Promise.all([
      supabase.from('expense_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('expense_lines').select('*'),
    ]);
    const firstError = requestsRes.error || linesRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setRequests(
      assemble((requestsRes.data ?? []) as ExpenseRequestWithLines[], linesRes.data ?? [])
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { requests, loading, error, reload };
}

export function approvedSpend(requests: ExpenseRequestWithLines[]): number {
  return requests.filter((r) => r.status === 'Approved').reduce((sum, r) => sum + (r.total_amount || 0), 0);
}

export function availableBudget(budget: BudgetRow | null, requests: ExpenseRequestWithLines[]): number {
  return (budget?.approved_amount ?? 0) - approvedSpend(requests);
}

export function getEventApprovedBudget(requests: ExpenseRequestWithLines[], eventId: string): number {
  return requests
    .filter((r) => r.event_id === eventId && r.status === 'Approved')
    .reduce((sum, r) => sum + (r.total_amount || 0), 0);
}

export function getEventFinanceRequests(requests: ExpenseRequestWithLines[], eventId: string): ExpenseRequestWithLines[] {
  return requests.filter((r) => r.event_id === eventId);
}

export function eventFinanceStatus(requests: ExpenseRequestWithLines[], eventId: string): FinanceStatus {
  const forEvent = getEventFinanceRequests(requests, eventId);
  return {
    hasApproved: forEvent.some((r) => r.status === 'Approved'),
    hasPending: forEvent.some(
      (r) => r.status === 'Pending President Recommendation' || r.status === 'Pending Final Approval'
    ),
  };
}

/** For the Events module: a lightweight per-event finance summary without pulling in the full Finance UI. */
export function useEventFinanceSummary() {
  const [requests, setRequests] = useState<
    Pick<ExpenseRequestWithLines, 'id' | 'event_id' | 'status' | 'total_amount'>[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('expense_requests')
      .select('id,event_id,status,total_amount')
      .then(({ data }) => {
        if (active) {
          setRequests((data ?? []) as ExpenseRequestWithLines[]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const statusByEvent = useMemo(() => {
    const map = new Map<string, FinanceStatus>();
    for (const r of requests) {
      if (!r.event_id) continue;
      const existing = map.get(r.event_id) ?? { hasApproved: false, hasPending: false };
      if (r.status === 'Approved') existing.hasApproved = true;
      if (r.status === 'Pending President Recommendation' || r.status === 'Pending Final Approval') existing.hasPending = true;
      map.set(r.event_id, existing);
    }
    return map;
  }, [requests]);

  const approvedBudgetByEvent = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of requests) {
      if (!r.event_id || r.status !== 'Approved') continue;
      map.set(r.event_id, (map.get(r.event_id) ?? 0) + (r.total_amount || 0));
    }
    return map;
  }, [requests]);

  return { loading, statusByEvent, approvedBudgetByEvent };
}

function computeTotals(lines: DraftLine[], contingencyPercent = 5) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);
  const contingencyAmount = Math.round(subtotal * (contingencyPercent / 100) * 100) / 100;
  const total = subtotal + contingencyAmount;
  return { subtotal, contingencyAmount, total };
}

export async function createExpenseRequest(
  payload: {
    title: string;
    event_id: string | null;
    event_name: string | null;
    category: string | null;
    purpose: string | null;
    requested_by: string;
    requester_role: string;
    requested_by_user: string;
    final_approver_name: string;
    final_approver_role: string;
    final_approver_email: string;
    president_availability: string;
    request_date: string;
    planned_event_budget: number;
    previous_approved_event_spend: number;
    overrun_justification: string | null;
    budget_available_before_approval: number;
  },
  lines: DraftLine[]
) {
  const { subtotal, contingencyAmount, total } = computeTotals(lines);
  const id = crypto.randomUUID();
  const onLeave = payload.president_availability.toLowerCase() === 'on leave';
  const projectedEventSpend = payload.planned_event_budget > 0 ? payload.previous_approved_event_spend + total : 0;
  const overBudget = payload.planned_event_budget > 0 && projectedEventSpend > payload.planned_event_budget;

  const { error: requestError } = await supabase.from('expense_requests').insert({
    id,
    request_number: `EXP-${Date.now().toString(36).toUpperCase()}`,
    title: payload.title,
    event_id: payload.event_id,
    event_name: payload.event_name,
    request_date: payload.request_date,
    category: payload.category,
    purpose: payload.purpose,
    requested_by: payload.requested_by,
    requester_role: payload.requester_role,
    requested_by_user: payload.requested_by_user,
    final_approver_name: payload.final_approver_name,
    final_approver_role: payload.final_approver_role,
    final_approver_email: payload.final_approver_email,
    president_availability: payload.president_availability,
    status: 'Draft',
    subtotal,
    contingency_percent: 5,
    contingency_amount: contingencyAmount,
    total_amount: total,
    submitted_at: new Date().toISOString(),
    planned_event_budget: payload.planned_event_budget,
    previous_approved_event_spend: payload.previous_approved_event_spend,
    projected_event_spend: projectedEventSpend,
    over_budget: overBudget,
    overrun_amount: overBudget ? projectedEventSpend - payload.planned_event_budget : 0,
    overrun_justification: overBudget ? payload.overrun_justification : null,
    budget_available_before_approval: payload.budget_available_before_approval,
    budget_available_after_approval: payload.budget_available_before_approval - total,
  });
  if (requestError) throw requestError;

  const lineRows = lines.map((l, i) => ({
    expense_request_id: id,
    line_no: i + 1,
    description: l.description,
    quantity: l.quantity,
    rate: l.rate,
    line_total: l.quantity * l.rate,
    vendor: l.vendor || null,
    reimbursement_required: l.reimbursement_required,
  }));
  const { error: linesError } = await supabase.from('expense_lines').insert(lineRows);
  if (linesError) throw linesError;

  const { error: submitError } = await supabase
    .from('expense_requests')
    .update({ status: onLeave ? 'Pending Final Approval' : 'Pending President Recommendation' })
    .eq('id', id);
  if (submitError) throw submitError;

  return id;
}

async function recordApproval(payload: {
  expense_request_id: string;
  stage: string;
  decision: string;
  approver_name: string;
  approver_role: string;
  comment?: string | null;
}) {
  const { error } = await supabase.from('expense_approvals').insert(payload);
  if (error) throw error;
}

export async function presidentDecision(
  request: ExpenseRequestWithLines,
  decision: 'recommend' | 'reject',
  comment: string,
  actorName: string,
  actorRole: string
) {
  const nextStatus = decision === 'recommend' ? 'Pending Final Approval' : 'Rejected';
  const { error } = await supabase
    .from('expense_requests')
    .update({
      status: nextStatus,
      president_recommendation: decision === 'recommend' ? 'Recommended' : 'Rejected',
      president_comment: comment || null,
      recommended_by_name: actorName,
      recommended_by_role: actorRole,
    })
    .eq('id', request.id);
  if (error) throw error;
  await recordApproval({
    expense_request_id: request.id,
    stage: 'President',
    decision: decision === 'recommend' ? 'Recommended' : 'Rejected',
    approver_name: actorName,
    approver_role: actorRole,
    comment,
  });
}

export async function finalDecision(
  request: ExpenseRequestWithLines,
  decision: 'approve' | 'reject',
  comment: string,
  actorName: string,
  actorRole: string
) {
  const nextStatus = decision === 'approve' ? 'Approved' : 'Rejected';
  const { error } = await supabase
    .from('expense_requests')
    .update({
      status: nextStatus,
      final_approver_comment: comment || null,
      approved_by_name: decision === 'approve' ? actorName : null,
      approved_by_role: decision === 'approve' ? actorRole : null,
      approved_at: decision === 'approve' ? new Date().toISOString() : null,
    })
    .eq('id', request.id);
  if (error) throw error;
  await recordApproval({
    expense_request_id: request.id,
    stage: 'Final Approval',
    decision: decision === 'approve' ? 'Approved' : 'Rejected',
    approver_name: actorName,
    approver_role: actorRole,
    comment,
  });
}

export async function cancelRequest(id: string) {
  const { error } = await supabase.from('expense_requests').update({ status: 'Cancelled' }).eq('id', id);
  if (error) throw error;
}

export async function requestReversal(expenseRequestId: string, reason: string, requestedByName: string, requestedByUser: string) {
  const { error } = await supabase.from('expense_reversals').insert({
    expense_request_id: expenseRequestId,
    requested_by: requestedByUser,
    requested_by_name: requestedByName,
    reason,
  });
  if (error) throw error;
  const { error: flagError } = await supabase
    .from('expense_requests')
    .update({
      reversal_status: 'Pending President Approval',
      reversal_reason: reason,
      reversal_requested_by: requestedByName,
      reversal_requested_at: new Date().toISOString(),
    })
    .eq('id', expenseRequestId);
  if (flagError) throw flagError;
}

export async function decideReversal(
  reversal: ExpenseReversalRow,
  decision: 'approve' | 'reject',
  comment: string,
  decidedByName: string,
  decidedByUser: string
) {
  const nextStatus = decision === 'approve' ? 'Approved' : 'Rejected';
  const { error } = await supabase
    .from('expense_reversals')
    .update({
      status: nextStatus,
      president_comment: comment || null,
      decided_by: decidedByUser,
      decided_by_name: decidedByName,
      decided_at: new Date().toISOString(),
    })
    .eq('id', reversal.id);
  if (error) throw error;

  if (decision === 'approve') {
    const { error: reqError } = await supabase
      .from('expense_requests')
      .update({
        status: 'Reversed',
        reversal_status: 'Approved',
        reversal_president_comment: comment || null,
        reversed_by: decidedByName,
        reversed_at: new Date().toISOString(),
      })
      .eq('id', reversal.expense_request_id);
    if (reqError) throw reqError;
  } else {
    const { error: reqError } = await supabase
      .from('expense_requests')
      .update({ reversal_status: 'Rejected', reversal_president_comment: comment || null })
      .eq('id', reversal.expense_request_id);
    if (reqError) throw reqError;
  }
}

export function useReversals() {
  const [reversals, setReversals] = useState<ExpenseReversalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expense_reversals')
      .select('*')
      .eq('status', 'Pending President Approval')
      .order('requested_at', { ascending: false });
    setReversals(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { reversals, loading, reload };
}

export function useCurrentActor() {
  const { profile } = useAuth();
  return { name: profile?.full_name || profile?.email || 'Unknown', role: profile?.role || '', id: profile?.id || '' };
}
