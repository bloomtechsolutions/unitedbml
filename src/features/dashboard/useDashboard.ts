import { useMemo, useState } from 'react';
import type { Profile } from '../../types/database';
import { eventLifecycle, localTodayIso } from '../events/lifecycle';
import { useEvents } from '../events/useEvents';
import { meetingStatus } from '../meetings/status';
import { useMeetings } from '../meetings/useMeetings';
import { approvedSpend, availableBudget, useBudget, useExpenseRequests } from '../finance/useFinance';
import { useStandingAllocationsActual } from '../allocations/useAllocations';
import { useReimbursementCases } from '../reimbursements/useReimbursements';

export interface AgendaItem {
  key: string;
  date: string;
  time: string;
  type: 'event' | 'meeting';
  title: string;
  detail: string;
  href: string;
}

export interface PriorityItem {
  key: string;
  level: 'danger' | 'normal';
  title: string;
  detail: string;
  status: string;
  href: string;
  /** Set for pending expense-request items — clicking opens RequestDetailModal in place
   * instead of navigating to Finance, so an approver can act without leaving the Dashboard. */
  requestId?: string;
}

export interface RecentItem {
  key: string;
  at: string;
  title: string;
  detail: string;
  href: string;
}

function relativeDay(iso: string): string {
  const diff = Math.ceil(
    (new Date(`${iso}T23:59:59`).getTime() - new Date(`${localTodayIso()}T00:00:00`).getTime()) / 86400000
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return iso;
}

export function useDashboard(profile: Profile | null) {
  const { events, loading: eventsLoading } = useEvents();
  const { meetings, loading: meetingsLoading } = useMeetings();
  const { budget, loading: budgetLoading } = useBudget();
  const { requests, loading: requestsLoading, reload: reloadRequests } = useExpenseRequests();
  const { cases: reimbursementCases, batches: apBatches, loading: reimbLoading } = useReimbursementCases();

  const [agendaRange, setAgendaRange] = useState<7 | 30>(7);

  const loading = eventsLoading || meetingsLoading || budgetLoading || requestsLoading || reimbLoading;
  const today = localTodayIso();

  const activeEvents = useMemo(
    () => events.filter((e) => !e.archived && !['Closed', 'Cancelled'].includes(eventLifecycle(e, e.tasks))),
    [events]
  );

  const upcomingEvents30 = useMemo(() => {
    const end = new Date(new Date(`${today}T00:00:00`).getTime() + 30 * 86400000).toISOString().slice(0, 10);
    return events.filter((e) => e.event_date && e.event_date >= today && e.event_date <= end);
  }, [events, today]);

  const openTasks = useMemo(() => events.flatMap((e) => e.tasks.filter((t) => !t.done)), [events]);
  const overdueTasks = useMemo(() => openTasks.filter((t) => t.due_date && t.due_date < today), [openTasks, today]);

  const myName = (profile?.full_name || '').trim().toLowerCase();
  const isPresident = profile?.role === 'President';
  const myOverdueTasks = useMemo(
    () => overdueTasks.filter((t) => myName && (t.owner || '').trim().toLowerCase() === myName),
    [overdueTasks, myName]
  );
  const myOpenTasks = useMemo(
    () => openTasks.filter((t) => t.due_date && t.due_date >= today && myName && (t.owner || '').trim().toLowerCase() === myName),
    [openTasks, today, myName]
  );

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'Pending President Recommendation' || r.status === 'Pending Final Approval'),
    [requests]
  );

  // Requests where the logged-in user is the actual next actor — the President at the
  // recommendation stage, or the specific person picked as final approver — mirroring the same
  // gating RequestDetailModal uses for showing its Approve/Reject buttons.
  const myApprovalRequests = useMemo(() => {
    const actorEmail = (profile?.email || '').toLowerCase().trim();
    const actorName = (profile?.full_name || '').toLowerCase().trim();
    return pendingRequests.filter((r) => {
      if (r.status === 'Pending President Recommendation') return isPresident;
      if (r.status === 'Pending Final Approval') {
        const selectedEmail = (r.final_approver_email || '').toLowerCase().trim();
        return selectedEmail ? actorEmail === selectedEmail : (r.final_approver_name || '').toLowerCase().trim() === actorName;
      }
      return false;
    });
  }, [pendingRequests, isPresident, profile]);

  const openReimbursements = useMemo(
    () =>
      reimbursementCases.filter((c) => {
        const batchesForCase = apBatches.filter((b) => b.reimbursement_id === c.id);
        if (!batchesForCase.length) return true;
        return batchesForCase.some((b) => b.status !== 'Paid' && b.status !== 'Cancelled');
      }),
    [reimbursementCases, apBatches]
  );

  const myOpenReimbursements = useMemo(() => {
    const myId = profile?.id;
    return openReimbursements.filter((c) => {
      const event = c.event_id ? events.find((e) => e.id === c.event_id) : null;
      if (myId && event?.reimbursement_manager_user_id === myId) return true;
      return myName && (c.requested_by || '').trim().toLowerCase() === myName;
    });
  }, [openReimbursements, events, profile, myName]);

  const spend = approvedSpend(requests);
  const { total: standingAllocationsActual } = useStandingAllocationsActual(new Date().getFullYear());
  const available = availableBudget(budget, requests, standingAllocationsActual);
  const budgetPct = budget?.approved_amount ? Math.max(0, Math.min(100, (available / budget.approved_amount) * 100)) : 0;

  const agenda = useMemo<AgendaItem[]>(() => {
    const end = new Date(new Date(`${today}T00:00:00`).getTime() + agendaRange * 86400000).toISOString().slice(0, 10);
    const items: AgendaItem[] = [];
    for (const e of events) {
      if (e.archived || !e.event_date || e.event_date < today || e.event_date > end) continue;
      items.push({
        key: `event-${e.id}`,
        date: e.event_date,
        time: '',
        type: 'event',
        title: e.name,
        detail: `${e.venue || 'Venue TBC'} · ${eventLifecycle(e, e.tasks)}`,
        href: `/events`,
      });
    }
    for (const m of meetings) {
      if (m.cancelled || !m.meeting_date || m.meeting_date < today || m.meeting_date > end) continue;
      items.push({
        key: `meeting-${m.id}`,
        date: m.meeting_date,
        time: m.meeting_time || '',
        type: 'meeting',
        title: m.title,
        detail: m.location || 'Meeting',
        href: `/meetings?open=${m.id}`,
      });
    }
    return items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 14);
  }, [events, meetings, agendaRange, today]);

  const priorityWork = useMemo<PriorityItem[]>(() => {
    const rows: PriorityItem[] = [];
    for (const t of myOverdueTasks) {
      rows.push({
        key: `task-${t.id}`,
        level: 'danger',
        title: t.task_text,
        detail: `Event task · ${relativeDay(t.due_date!)}`,
        status: 'Overdue',
        href: `/events`,
      });
    }
    for (const t of myOpenTasks) {
      rows.push({
        key: `task-due-${t.id}`,
        level: 'normal',
        title: t.task_text,
        detail: `Event task · ${relativeDay(t.due_date!)}`,
        status: 'Task',
        href: `/events`,
      });
    }
    for (const r of myApprovalRequests) {
      rows.push({
        key: `finance-${r.id}`,
        level: 'normal',
        title: r.title || r.request_number || 'Expense request',
        detail: `${r.request_number ?? ''} · ${r.status} · MVR ${(r.total_amount ?? 0).toLocaleString()}`,
        status: 'Click to Approve',
        href: `/finance`,
        requestId: r.id,
      });
    }
    for (const c of myOpenReimbursements) {
      rows.push({
        key: `reimb-${c.id}`,
        level: 'normal',
        title: c.event_name || c.case_ref || 'Reimbursement',
        detail: `${c.case_ref ?? ''} · ${c.status}`,
        status: 'Reimbursement',
        href: `/reimbursements`,
      });
    }
    return rows.sort((a, b) => (a.level === b.level ? 0 : a.level === 'danger' ? -1 : 1)).slice(0, 10);
  }, [myOverdueTasks, myOpenTasks, myApprovalRequests, myOpenReimbursements]);

  const recentActivity = useMemo<RecentItem[]>(() => {
    const rows: RecentItem[] = [];
    for (const e of events) {
      rows.push({ key: `event-${e.id}`, at: e.created_at, title: 'Event created', detail: e.name, href: `/events` });
    }
    for (const m of meetings) {
      rows.push({ key: `meeting-${m.id}`, at: m.created_at, title: 'Meeting scheduled', detail: m.title, href: `/meetings?open=${m.id}` });
    }
    for (const r of requests) {
      rows.push({
        key: `req-${r.id}`,
        at: r.submitted_at || r.request_date || '',
        title: `Expense request ${r.status}`,
        detail: `${r.request_number ?? ''} · ${r.title ?? ''}`,
        href: `/finance`,
      });
    }
    return rows
      .filter((r) => r.at)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 5);
  }, [events, meetings, requests]);

  const financeSnapshot = useMemo(
    () => ({
      annualBudget: budget?.approved_amount ?? 0,
      available,
      approvedSpend: spend,
      pendingValue: pendingRequests.reduce((sum, r) => sum + (r.total_amount || 0), 0),
      pendingCount: pendingRequests.length,
      openReimbursements: openReimbursements.length,
    }),
    [budget, available, spend, pendingRequests, openReimbursements]
  );

  return {
    loading,
    agendaRange,
    setAgendaRange,
    metrics: {
      activeEvents: activeEvents.length,
      pendingApprovals: pendingRequests.length,
      openTasks: openTasks.length,
      upcoming30: upcomingEvents30.length,
      available,
      budgetPct,
    },
    agenda,
    priorityWork,
    recentActivity,
    financeSnapshot,
    meetingStatusOf: meetingStatus,
    requests,
    reloadRequests,
  };
}
