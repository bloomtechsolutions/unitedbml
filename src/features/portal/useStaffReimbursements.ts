import { useMemo } from 'react';
import { useAuth } from '../../lib/AuthContext';
import type { EventRow } from '../../types/database';
import { apCommittedTotal, apPaidTotal, useEligibleExpenseRequests, useReimbursementCases } from '../reimbursements/useReimbursements';
import type { ApBatchWithBills, EligibleExpenseRequest, ProcurementGroupCase } from '../reimbursements/types';
import { useMyManagedEvents } from './usePortal';

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
      const submittedTotal = eventCases.reduce((s, c) => s + apCommittedTotal(batches, c.id), 0);
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

/** The one Draft batch currently in flight for a case (submitted but not yet sent to AP), if
 * any — a case can have several batches over time (e.g. a first partial submission already Paid,
 * then a second for the remaining balance), but only one can be an open Draft at once. */
export function draftBatchForCase(batches: ApBatchWithBills[], caseId: string): ApBatchWithBills | null {
  return batches.find((b) => b.reimbursement_id === caseId && b.status === 'Draft') ?? null;
}

/** Every non-cancelled batch for a case, newest first — the full submission history, not just
 * the latest one, since a case can be submitted more than once as balance allows. */
export function batchesForCase(batches: ApBatchWithBills[], caseId: string): ApBatchWithBills[] {
  return batches
    .filter((b) => b.reimbursement_id === caseId && b.status !== 'Cancelled')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
