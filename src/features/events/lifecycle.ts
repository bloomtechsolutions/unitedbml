import type { EventRow, EventTaskRow } from '../../types/database';

export function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysUntilEvent(event: Pick<EventRow, 'event_date'>): number {
  if (!event.event_date) return 0;
  const today = new Date(`${localTodayIso()}T00:00:00`);
  const target = new Date(`${event.event_date}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function eventPreparationProgress(tasks: EventTaskRow[]): number {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

export type EventLifecycle = 'Closed' | 'Cancelled' | 'Post-Event Settlement' | 'Event Day' | 'Ready' | 'Planning';

export interface FinanceStatus {
  hasApproved: boolean;
  hasPending: boolean;
}

const NO_FINANCE: FinanceStatus = { hasApproved: false, hasPending: false };

/**
 * Mirrors the original eventLifecycle() in index.html:5364. `finance` comes from the Finance
 * module (features/finance/useFinance.ts's eventFinanceStatus()/useEventFinanceSummary()) — when
 * omitted (e.g. a caller that hasn't loaded Finance data), it defaults to "no finance data", which
 * only changes the outcome when the event actually has a planned_budget > 0.
 */
export function eventLifecycle(event: EventRow, tasks: EventTaskRow[], finance: FinanceStatus = NO_FINANCE): EventLifecycle {
  if (event.archived) return 'Closed';
  if (event.cancelled_at || event.manual_state === 'Cancelled' || event.status === 'Cancelled') return 'Cancelled';

  const today = localTodayIso();
  const prep = eventPreparationProgress(tasks);
  const attendanceRecorded = event.attendance_count > 0;
  const settlementClosed = (event.finance_settlement_status || 'Pending Actuals') === 'Closed';

  if (event.event_date && event.event_date < today) {
    if (attendanceRecorded && settlementClosed) return 'Closed';
    return 'Post-Event Settlement';
  }

  if (event.event_date === today) return 'Event Day';

  const budgetRequired = Number(event.planned_budget || 0) > 0;
  const financeReady = !budgetRequired || (finance.hasApproved && !finance.hasPending);
  const allTasksComplete = tasks.length > 0 && prep === 100;
  if (allTasksComplete && financeReady) return 'Ready';

  return 'Planning';
}

export function syncedStatus(lifecycle: EventLifecycle): string {
  switch (lifecycle) {
    case 'Ready':
      return 'Ready';
    case 'Event Day':
      return 'Open';
    case 'Post-Event Settlement':
    case 'Closed':
      return 'Completed';
    case 'Cancelled':
      return 'Cancelled';
    default:
      return 'Planning';
  }
}

export type EventReadiness = 'Closed' | 'In Progress' | 'Needs Attention' | 'Ready' | 'At Risk';

export function eventReadiness(event: EventRow, tasks: EventTaskRow[], finance: FinanceStatus = NO_FINANCE): EventReadiness {
  const lifecycle = eventLifecycle(event, tasks, finance);
  if (lifecycle === 'Closed' || lifecycle === 'Cancelled') return 'Closed';
  if (lifecycle === 'Event Day') return 'In Progress';
  if (lifecycle === 'Post-Event Settlement') return 'Needs Attention';
  if (lifecycle === 'Ready') return 'Ready';

  const today = localTodayIso();
  const overdue = tasks.some((t) => !t.done && t.due_date && t.due_date < today);
  const days = daysUntilEvent(event);

  if (overdue && days <= 3) return 'At Risk';
  return 'Needs Attention';
}

export function eventLifecycleAlert(event: EventRow, tasks: EventTaskRow[], finance: FinanceStatus = NO_FINANCE): string {
  const lifecycle = eventLifecycle(event, tasks, finance);
  const days = daysUntilEvent(event);
  const prep = eventPreparationProgress(tasks);

  if (lifecycle === 'Cancelled') {
    return 'Event cancelled. Financial records remain preserved for audit.';
  }
  if (event.event_date && event.event_date < localTodayIso() && lifecycle === 'Post-Event Settlement') {
    return 'Post-event settlement in progress. Complete attendance and actual expense settlement to close this activity automatically.';
  }
  if (lifecycle === 'Ready') {
    return `Automatically marked Ready. All assigned tasks are complete. ${days} day${days === 1 ? '' : 's'} remaining until the event.`;
  }
  if (lifecycle === 'Planning') {
    const reasons: string[] = [];
    if (tasks.length === 0) reasons.push('no preparation tasks have been assigned');
    else if (prep < 100) reasons.push(`preparation is ${prep}% complete`);
    if (Number(event.planned_budget || 0) > 0) {
      if (finance.hasPending) reasons.push('finance approval is still pending');
      else if (!finance.hasApproved) reasons.push('the event budget has not been approved');
    }
    return `Planning status is automatic. ${reasons.length ? reasons.join('; ') : 'Preparation requirements are not yet complete'}.`;
  }
  if (lifecycle === 'Event Day') {
    return `Event Day. The event date is today. Preparation: ${prep}%.`;
  }
  return 'Event is closed.';
}
