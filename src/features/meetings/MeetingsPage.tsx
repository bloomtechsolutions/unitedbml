'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { useCommitteeMembers } from '../events/useEvents';
import type { MeetingActionRow, MeetingRow } from '../../types/database';
import { MeetingFormModal } from './MeetingFormModal';
import { MeetingWorkspaceModal } from './MeetingWorkspaceModal';
import { isDueToday, isOverdue, meetingStatus, localTodayIso } from './status';
import { MEETING_STATUSES } from './types';
import type { MeetingStatus, MeetingWithChildren } from './types';
import {
  applyCarryForward,
  cancelMeeting,
  createMeeting,
  notifyMeetingAttendees,
  pendingEventCreationAgenda,
  recordActionHistory,
  saveAction,
  updateMeeting,
  useMeetings,
} from './useMeetings';

type SubTab = 'meetings' | 'actions' | 'decisions';

const STATUS_PILL: Record<MeetingStatus, string> = {
  Scheduled: 'ub-pill-warning',
  'In Progress': 'ub-pill-accent',
  'Minutes Pending': 'ub-pill-gold',
  Completed: 'ub-pill-success',
  Cancelled: 'ub-pill-neutral',
};

export function MeetingsPage() {
  const { isCommitteeUser } = useAuth();
  const { meetings, loading, error, reload } = useMeetings();
  const coordinators = useCommitteeMembers();
  const toast = useToast();

  const [subTab, setSubTab] = useState<SubTab>('meetings');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | ''>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingRow | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) setWorkspaceId(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enriched = useMemo(
    () => meetings.map((meeting) => ({ meeting, status: meetingStatus(meeting) })),
    [meetings]
  );

  const filtered = enriched.filter(({ meeting, status }) => {
    const matchesSearch = !search || meeting.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const today = localTodayIso();
  const thisMonth = today.slice(0, 7);
  const allActions = meetings.flatMap((m) => m.actions.map((a) => ({ meeting: m, action: a })));
  const openActions = allActions.filter(({ action }) => action.status !== 'Completed');
  const overdueActions = allActions.filter(({ action }) => isOverdue(action.due_date, action.status));
  const pendingMinutes = meetings.filter((m) => meetingStatus(m) === 'Minutes Pending');
  const pendingEventCreation = pendingEventCreationAgenda(meetings);

  const kpis = {
    upcoming: meetings.filter((m) => meetingStatus(m) === 'Scheduled').length,
    thisMonth: meetings.filter((m) => (m.meeting_date || '').slice(0, 7) === thisMonth).length,
    openActions: openActions.length,
    overdueActions: overdueActions.length,
    pendingMinutes: pendingMinutes.length,
    pendingEventCreation: pendingEventCreation.length,
  };

  const allDecisions = meetings.flatMap((m) => m.decisions.map((d) => ({ meeting: m, decision: d })));

  const workspaceMeeting = workspaceId ? meetings.find((m) => m.id === workspaceId) ?? null : null;

  const handleSaveMeeting = async (payload: Partial<MeetingRow>, carryForwardIds: string[]) => {
    if (editingMeeting) {
      await updateMeeting(editingMeeting.id, payload);
      toast('Meeting updated');
      await reload();
    } else {
      const id = await createMeeting(payload, coordinators);
      if (carryForwardIds.length) {
        const actions = meetings.flatMap((m) => m.actions).filter((a) => carryForwardIds.includes(a.id));
        await applyCarryForward(id, actions, meetings);
      }
      try {
        await notifyMeetingAttendees(id);
      } catch {
        // Non-fatal — the meeting itself is scheduled either way.
      }
      toast('Meeting scheduled — attendees notified');
      await reload();
      setWorkspaceId(id);
    }
  };

  const handleCancelMeeting = async (meeting: MeetingWithChildren) => {
    if (!confirm(`Cancel "${meeting.title}"? Agenda, decisions, and actions are retained.`)) return;
    await cancelMeeting(meeting.id);
    await reload();
    toast('Meeting cancelled');
    setWorkspaceId(null);
  };

  const handleQuickActionStatus = async (action: MeetingActionRow, meeting: MeetingWithChildren, status: string) => {
    await saveAction({ ...action, status, done: status === 'Completed' }, meeting);
    await recordActionHistory({ meeting_action_id: action.id, action: 'status_change', old_status: action.status, new_status: status });
    await reload();
  };

  if (loading) return <div>Loading meetings…</div>;
  if (error) return <div style={{ color: 'var(--ub-danger)' }}>Failed to load meetings: {error}</div>;

  return (
    <div>
      <div className="ub-page-head">
        <div>
          <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            Governance
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>Meetings</h1>
          <p>Agendas, decisions, and actions — with a straight line from an agenda item to a scheduled event.</p>
        </div>
        {isCommitteeUser && (
          <button
            className="ub-btn ub-btn-primary"
            onClick={() => {
              setEditingMeeting(null);
              setFormOpen(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
            Schedule Meeting
          </button>
        )}
      </div>

      <div className="ub-kpi-row">
        <div className="ub-card ub-kpi">
          <div className="ub-kpi-value">{kpis.upcoming}</div>
          <div className="ub-kpi-label">Upcoming</div>
        </div>
        <div className="ub-card ub-kpi">
          <div className="ub-kpi-value">{kpis.thisMonth}</div>
          <div className="ub-kpi-label">This Month</div>
        </div>
        <div className="ub-card ub-kpi">
          <div className="ub-kpi-value">{kpis.openActions}</div>
          <div className="ub-kpi-label">Open Actions</div>
        </div>
        <div className="ub-card ub-kpi">
          <div className="ub-kpi-value" style={{ color: kpis.overdueActions ? 'var(--ub-danger-dark)' : undefined }}>{kpis.overdueActions}</div>
          <div className="ub-kpi-label">Overdue Actions</div>
        </div>
        <div className="ub-card ub-kpi">
          <div className="ub-kpi-value">{kpis.pendingMinutes}</div>
          <div className="ub-kpi-label">Minutes Pending</div>
        </div>
        <div className="ub-card ub-kpi">
          <div className="ub-kpi-value" style={{ color: kpis.pendingEventCreation ? 'var(--ub-accent-dark)' : undefined }}>{kpis.pendingEventCreation}</div>
          <div className="ub-kpi-label">Pending Event Creation</div>
        </div>
      </div>

      <div className="ub-tabs">
        <button className={`ub-tab ${subTab === 'meetings' ? 'active' : ''}`} onClick={() => setSubTab('meetings')}>
          Meetings
        </button>
        <button className={`ub-tab ${subTab === 'actions' ? 'active' : ''}`} onClick={() => setSubTab('actions')}>
          Action Follow-up
        </button>
        <button className={`ub-tab ${subTab === 'decisions' ? 'active' : ''}`} onClick={() => setSubTab('decisions')}>
          Decision Register
        </button>
      </div>

      {subTab === 'meetings' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <div className="ub-field" style={{ width: 280 }}>
              <input placeholder="Search meetings…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="ub-field" style={{ width: 200 }}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as MeetingStatus | '')}>
                <option value="">All statuses</option>
                {MEETING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map(({ meeting, status }) => (
              <div
                key={meeting.id}
                className="ub-card"
                style={{ cursor: 'pointer', padding: 20 }}
                onClick={() => setWorkspaceId(meeting.id)}
              >
                <span className={`ub-pill ${STATUS_PILL[status]}`}>{status}</span>
                <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: '10px 0 8px' }}>{meeting.title}</h3>
                <div style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', lineHeight: 1.7 }}>
                  {meeting.meeting_date} · {meeting.meeting_time}
                  <br />
                  {meeting.location}
                </div>
              </div>
            ))}
            {!filtered.length && <div className="ub-empty">No meetings match your filters.</div>}
          </div>
        </>
      )}

      {subTab === 'actions' && (
        <table className="ub-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Meeting</th>
              <th>Assigned To</th>
              <th>Due</th>
              <th>Linked Event</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allActions
              .sort((a, b) => {
                if ((a.action.status === 'Completed') !== (b.action.status === 'Completed')) {
                  return a.action.status === 'Completed' ? 1 : -1;
                }
                return (a.action.due_date || '').localeCompare(b.action.due_date || '');
              })
              .map(({ meeting, action }) => (
                <tr
                  key={action.id}
                  className={isOverdue(action.due_date, action.status) ? 'ub-row-overdue' : isDueToday(action.due_date, action.status) ? 'ub-row-due' : ''}
                >
                  <td>
                    {action.action_text}
                    {action.remarks && <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)' }}>{action.remarks}</div>}
                  </td>
                  <td>
                    <button className="ub-btn ub-btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setWorkspaceId(meeting.id)}>
                      {meeting.title}
                    </button>
                  </td>
                  <td>{action.assigned_to || '—'}</td>
                  <td>
                    {action.due_date || '—'}{' '}
                    {isOverdue(action.due_date, action.status) && <span className="ub-pill ub-pill-danger">Overdue</span>}
                  </td>
                  <td>{action.event_id ? 'Linked' : '—'}</td>
                  <td>
                    <select value={action.status} onChange={(e) => void handleQuickActionStatus(action, meeting, e.target.value)}>
                      {['Open', 'In Progress', 'Completed', 'Deferred'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            {!allActions.length && (
              <tr>
                <td colSpan={6} className="ub-empty">
                  No action items recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {subTab === 'decisions' && (
        <table className="ub-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Meeting</th>
              <th>Decision</th>
              <th>Outcome</th>
              <th>Responsible</th>
            </tr>
          </thead>
          <tbody>
            {allDecisions.map(({ meeting, decision }) => (
              <tr key={decision.id}>
                <td>{meeting.meeting_date}</td>
                <td>
                  <button className="ub-btn ub-btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setWorkspaceId(meeting.id)}>
                    {meeting.title}
                  </button>
                </td>
                <td>{decision.decision_text}</td>
                <td>
                  <span className={`ub-pill ${decision.outcome === 'Approved' ? 'ub-pill-success' : 'ub-pill-accent'}`}>{decision.outcome}</span>
                </td>
                <td>{decision.owner || '—'}</td>
              </tr>
            ))}
            {!allDecisions.length && (
              <tr>
                <td colSpan={5} className="ub-empty">
                  No decisions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <MeetingFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editingMeeting}
        coordinators={coordinators}
        allMeetings={meetings}
        onSave={handleSaveMeeting}
      />

      <MeetingWorkspaceModal
        meeting={workspaceMeeting}
        onClose={() => setWorkspaceId(null)}
        onEdit={(meeting) => {
          setEditingMeeting(meeting);
          setWorkspaceId(null);
          setFormOpen(true);
        }}
        onCancel={handleCancelMeeting}
        coordinators={coordinators}
        onRefresh={reload}
      />
    </div>
  );
}
