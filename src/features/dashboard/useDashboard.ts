import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import { eventLifecycle, localTodayIso } from '../events/lifecycle';
import { useEvents } from '../events/useEvents';
import type { EventWithChildren } from '../events/types';
import { meetingStatus } from '../meetings/status';
import { useMeetings } from '../meetings/useMeetings';
import type { MeetingWithChildren } from '../meetings/types';
import { approvedSpend, availableBudget, useBudget, useExpenseRequests } from '../finance/useFinance';
import type { ExpenseRequestWithLines } from '../finance/types';
import { useReimbursementCases } from '../reimbursements/useReimbursements';

export type DashboardView = 'Executive' | 'My';

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
}

export interface RecentItem {
  key: string;
  at: string;
  title: string;
  detail: string;
  href: string;
}

function isMine(name: string | null | undefined, profile: Profile | null): boolean {
  if (!name || !profile?.full_name) return false;
  return name.trim().toLowerCase() === profile.full_name.trim().toLowerCase();
}

function eventIsMine(event: EventWithChildren, profile: Profile | null): boolean {
  if (isMine(event.coordinator, profile)) return true;
  return event.tasks.some((t) => isMine(t.owner, profile));
}

function meetingIsMine(meeting: MeetingWithChildren, profile: Profile | null): boolean {
  if (isMine(meeting.chair, profile) || isMine(meeting.secretary, profile)) return true;
  return meeting.actions.some((a) => isMine(a.assigned_to, profile));
}

function requestIsMine(request: ExpenseRequestWithLines, profile: Profile | null): boolean {
  if (!profile) return false;
  if (request.requested_by_user === profile.id) return true;
  if (isMine(request.requested_by, profile) || isMine(request.final_approver_name, profile)) return true;
  if (profile.role === 'President' && request.status === 'Pending President Recommendation') return true;
  return false;
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

function useTournamentPulse() {
  const [active, setActive] = useState(0);
  const [live, setLive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('tournaments')
      .select('status')
      .then(({ data }) => {
        if (cancelled || !data) return;
        setActive(data.filter((t) => !['Completed', 'Cancelled'].includes(t.status)).length);
        setLive(data.filter((t) => t.status === 'Live').length);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { active, live };
}

export function useDashboard(profile: Profile | null) {
  const { events, loading: eventsLoading } = useEvents();
  const { meetings, loading: meetingsLoading } = useMeetings();
  const { budget, loading: budgetLoading } = useBudget();
  const { requests, loading: requestsLoading } = useExpenseRequests();
  const { cases: reimbursementCases, batches: apBatches, loading: reimbLoading } = useReimbursementCases();
  const tournamentPulse = useTournamentPulse();

  const [view, setView] = useState<DashboardView>('Executive');
  const [agendaRange, setAgendaRange] = useState<7 | 30>(7);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('ub-dashboard-view') : null;
    if (stored === 'My' || stored === 'Executive') setView(stored);
  }, []);

  const changeView = (next: DashboardView) => {
    setView(next);
    if (typeof window !== 'undefined') window.localStorage.setItem('ub-dashboard-view', next);
  };

  const loading = eventsLoading || meetingsLoading || budgetLoading || requestsLoading || reimbLoading;
  const my = view === 'My';
  const today = localTodayIso();

  const scopedEvents = useMemo(
    () => events.filter((e) => (my ? eventIsMine(e, profile) : true)),
    [events, my, profile]
  );
  const scopedMeetings = useMemo(
    () => meetings.filter((m) => (my ? meetingIsMine(m, profile) : true)),
    [meetings, my, profile]
  );
  const scopedRequests = useMemo(
    () => requests.filter((r) => (my ? requestIsMine(r, profile) : true)),
    [requests, my, profile]
  );

  const activeEvents = useMemo(
    () => scopedEvents.filter((e) => !e.archived && !['Closed', 'Cancelled'].includes(eventLifecycle(e, e.tasks))),
    [scopedEvents]
  );

  const upcomingEvents30 = useMemo(() => {
    const end = new Date(new Date(`${today}T00:00:00`).getTime() + 30 * 86400000).toISOString().slice(0, 10);
    return scopedEvents.filter((e) => e.event_date && e.event_date >= today && e.event_date <= end);
  }, [scopedEvents, today]);

  const openTasks = useMemo(() => scopedEvents.flatMap((e) => e.tasks.filter((t) => !t.done)), [scopedEvents]);
  const overdueTasks = useMemo(() => openTasks.filter((t) => t.due_date && t.due_date < today), [openTasks, today]);

  const pendingRequests = useMemo(
    () => scopedRequests.filter((r) => r.status === 'Pending President Recommendation' || r.status === 'Pending Final Approval'),
    [scopedRequests]
  );

  const openReimbursements = useMemo(
    () =>
      reimbursementCases.filter((c) => {
        const batchesForCase = apBatches.filter((b) => b.reimbursement_id === c.id);
        if (!batchesForCase.length) return true;
        return batchesForCase.some((b) => b.status !== 'Paid' && b.status !== 'Cancelled');
      }),
    [reimbursementCases, apBatches]
  );

  const spend = approvedSpend(requests);
  const available = availableBudget(budget, requests);
  const budgetPct = budget?.approved_amount ? Math.max(0, Math.min(100, (available / budget.approved_amount) * 100)) : 0;

  const agenda = useMemo<AgendaItem[]>(() => {
    const end = new Date(new Date(`${today}T00:00:00`).getTime() + agendaRange * 86400000).toISOString().slice(0, 10);
    const items: AgendaItem[] = [];
    for (const e of scopedEvents) {
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
    for (const m of scopedMeetings) {
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
  }, [scopedEvents, scopedMeetings, agendaRange, today]);

  const priorityWork = useMemo<PriorityItem[]>(() => {
    const rows: PriorityItem[] = [];
    for (const t of overdueTasks) {
      rows.push({
        key: `task-${t.id}`,
        level: 'danger',
        title: t.task_text,
        detail: `Event task${t.owner ? ` · ${t.owner}` : ''} · ${relativeDay(t.due_date!)}`,
        status: 'Overdue',
        href: `/events`,
      });
    }
    for (const t of openTasks.filter((t) => t.due_date && t.due_date >= today)) {
      rows.push({
        key: `task-due-${t.id}`,
        level: 'normal',
        title: t.task_text,
        detail: `Event task${t.owner ? ` · ${t.owner}` : ''} · ${relativeDay(t.due_date!)}`,
        status: 'Task',
        href: `/events`,
      });
    }
    for (const r of pendingRequests) {
      rows.push({
        key: `finance-${r.id}`,
        level: 'normal',
        title: r.title || r.request_number || 'Expense request',
        detail: `${r.request_number ?? ''} · ${r.status} · MVR ${(r.total_amount ?? 0).toLocaleString()}`,
        status: 'Approval',
        href: `/finance`,
      });
    }
    for (const c of openReimbursements) {
      rows.push({
        key: `reimb-${c.id}`,
        level: 'normal',
        title: c.event_name || c.case_ref || 'Reimbursement',
        detail: `${c.case_ref ?? ''} · ${c.status}`,
        status: 'Reimbursement',
        href: `/reimbursements`,
      });
    }
    return rows.sort((a, b) => (a.level === b.level ? 0 : a.level === 'danger' ? -1 : 1)).slice(0, my ? 8 : 10);
  }, [overdueTasks, openTasks, pendingRequests, openReimbursements, my, today]);

  const recentActivity = useMemo<RecentItem[]>(() => {
    const rows: RecentItem[] = [];
    for (const e of scopedEvents) {
      rows.push({ key: `event-${e.id}`, at: e.created_at, title: 'Event created', detail: e.name, href: `/events` });
    }
    for (const m of scopedMeetings) {
      rows.push({ key: `meeting-${m.id}`, at: m.created_at, title: 'Meeting scheduled', detail: m.title, href: `/meetings?open=${m.id}` });
    }
    for (const r of scopedRequests) {
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
      .slice(0, 8);
  }, [scopedEvents, scopedMeetings, scopedRequests]);

  const engagement = useMemo(() => {
    const totalAttendance = scopedEvents.reduce((sum, e) => sum + (e.attendance_count || 0), 0);
    const allTasks = scopedEvents.flatMap((e) => e.tasks);
    const completedTasks = allTasks.filter((t) => t.done).length;
    return {
      activeEvents: activeEvents.length,
      totalAttendance,
      taskCompletionPct: allTasks.length ? Math.round((completedTasks / allTasks.length) * 100) : 0,
      reimbursementCases: reimbursementCases.length,
    };
  }, [scopedEvents, activeEvents, reimbursementCases]);

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

  const operationalPulse = useMemo(
    () => ({
      activeEvents: activeEvents.length,
      upcomingMeetings: meetings.filter((m) => !m.cancelled && m.meeting_date && m.meeting_date >= today).length,
      openReimbursements: openReimbursements.length,
      activeTournaments: tournamentPulse.active,
      liveTournaments: tournamentPulse.live,
      overdueTasks: overdueTasks.length,
    }),
    [activeEvents, meetings, openReimbursements, tournamentPulse, overdueTasks, today]
  );

  return {
    loading,
    view,
    setView: changeView,
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
    engagement,
    financeSnapshot,
    operationalPulse,
    meetingStatusOf: meetingStatus,
  };
}
