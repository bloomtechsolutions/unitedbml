import { useMemo } from 'react';
import { useAuth } from '../../lib/AuthContext';
import type { EventRow } from '../../types/database';
import { apPaidTotal, useEligibleExpenseRequests, useReimbursementCases } from '../reimbursements/useReimbursements';
import type { ApBatchWithBills, EligibleExpenseRequest, ProcurementGroupCase } from '../reimbursements/types';
import { useMyManagedEvents } from './usePortal';

/** Everything the Manager has put forward for a case, whether or not AP has been sent yet —
 * unlike apSubmittedTotal (which only counts batches already sent to AP), this counts a
 * still-Draft/pending-review batch too, since from the Manager's perspective they've already
 * "submitted" it the moment they send it for committee review. */
export function managerSubmittedTotal(batches: ApBatchWithBills[], caseId: string): number {
  return batches
    .filter((b) => b.reimbursement_id === caseId && b.status !== 'Cancelled')
    .reduce((sum, b) => sum + b.bills.reduce((s, bill) => s + bill.amount, 0), 0);
}

export interface ManagedEventSummary {
  event: EventRow;
  cases: ProcurementGroupCase[];
  eligible: EligibleExpenseRequest[];
  approvedTotal: number;
  submittedTotal: number;
  paidTotal: number;
  balance: number;
  pendingReviewCount: number;
}

/** Everything a Reimbursement Manager (committee or Staff Member) needs to see and act on their
 * own assigned event(s) — relies entirely on RLS to scope cases/eligible items/batches down to
 * their own events, so the same queries used by the full Reimbursements page work unmodified. */
export function useStaffReimbursementWorkspace() {
  const { session } = useAuth();
  const { events, loading: eventsLoading, reload: reloadEvents } = useMyManagedEvents(session?.user.id);
  const { cases, batches, loading: casesLoading, reload: reloadCases } = useReimbursementCases();
  const { eligible, loading: eligibleLoading } = useEligibleExpenseRequests(cases);

  const summaries = useMemo<ManagedEventSummary[]>(() => {
    return events.map((event) => {
      const eventCases = cases.filter((c) => c.event_id === event.id);
      const eventEligible = eligible.filter((e) => e.eventId === event.id);
      const approvedFromCases = eventCases.reduce((s, c) => s + c.approved_item_amount, 0);
      const approvedFromEligible = eventEligible.reduce((s, r) => s + r.lines.reduce((ss, l) => ss + l.amount, 0), 0);
      const submittedTotal = eventCases.reduce((s, c) => s + managerSubmittedTotal(batches, c.id), 0);
      const paidTotal = eventCases.reduce((s, c) => s + apPaidTotal(batches, c.id), 0);
      const pendingReviewCount = batches.filter((b) => eventCases.some((c) => c.id === b.reimbursement_id) && b.pending_review).length;
      const approvedTotal = approvedFromCases + approvedFromEligible;
      return {
        event,
        cases: eventCases,
        eligible: eventEligible,
        approvedTotal,
        submittedTotal,
        paidTotal,
        balance: approvedTotal - submittedTotal,
        pendingReviewCount,
      };
    });
  }, [events, cases, eligible, batches]);

  const totals = useMemo(
    () => ({
      approved: summaries.reduce((s, m) => s + m.approvedTotal, 0),
      submitted: summaries.reduce((s, m) => s + m.submittedTotal, 0),
      paid: summaries.reduce((s, m) => s + m.paidTotal, 0),
      balance: summaries.reduce((s, m) => s + m.balance, 0),
      pendingReview: summaries.reduce((s, m) => s + m.pendingReviewCount, 0),
    }),
    [summaries]
  );

  return {
    events,
    cases,
    batches,
    eligible,
    summaries,
    totals,
    loading: eventsLoading || casesLoading || eligibleLoading,
    reload: async () => {
      await Promise.all([reloadEvents(), reloadCases()]);
    },
  };
}

export function draftBatchForCase(batches: ApBatchWithBills[], caseId: string): ApBatchWithBills | null {
  return batches.find((b) => b.reimbursement_id === caseId && b.status === 'Draft') ?? null;
}

export function latestBatchForCase(batches: ApBatchWithBills[], caseId: string): ApBatchWithBills | null {
  const matches = batches.filter((b) => b.reimbursement_id === caseId && b.status !== 'Cancelled');
  if (!matches.length) return null;
  return matches.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b));
}
