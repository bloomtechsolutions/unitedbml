'use client';

import { useMemo, useState } from 'react';
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
  pendingEventCreationAgenda,
  recordActionHistory,
  saveAction,
  updateMeeting,
  useMeetings,
} from './useMeetings';

type SubTab = 'meetings' | 'actions' | 'decisions';

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
      toast('Meeting scheduled');
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
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load meetings: {error}</div>;

  return (
    <div>
      <div className="meeting-hero">
        <div>
          <h2>Meetings</h2>
          <p>Schedule meetings, run agendas, and track decisions and follow-up actions.</p>
        </div>
        {isCommitteeUser && (
          <button
            className="btn primary"
            onClick={() => {
              setEditingMeeting(null);
              setFormOpen(true);
            }}
          >
            + Schedule Meeting
          </button>
        )}
      </div>

      <div className="meeting-kpis">
        <div className="kpi">
          <div className="lbl">Upcoming</div>
          <strong>{kpis.upcoming}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">This Month</div>
          <strong>{kpis.thisMonth}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Open Actions</div>
          <strong>{kpis.openActions}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Overdue Actions</div>
          <strong>{kpis.overdueActions}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Minutes Pending</div>
          <strong>{kpis.pendingMinutes}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Pending Event Creation</div>
          <strong>{kpis.pendingEventCreation}</strong>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${subTab === 'meetings' ? 'active' : ''}`} onClick={() => setSubTab('meetings')}>
          Meetings
        </button>
        <button className={`tab ${subTab === 'actions' ? 'active' : ''}`} onClick={() => setSubTab('actions')}>
          Action Follow-up
        </button>
        <button className={`tab ${subTab === 'decisions' ? 'active' : ''}`} onClick={() => setSubTab('decisions')}>
          Decision Register
        </button>
      </div>

      {subTab === 'meetings' && (
        <>
          <div className="toolbar">
            <div className="filters">
              <input placeholder="Search meetings…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <div className="meeting-grid">
            {filtered.map(({ meeting, status }) => (
              <div key={meeting.id} className="meeting-card" onClick={() => setWorkspaceId(meeting.id)}>
                <span className={`meeting-status ${status.replace(/\s/g, '')}`}>{status}</span>
                <h3>{meeting.title}</h3>
                <div className="meta">
                  <span>{meeting.meeting_date}</span>
                  <span>{meeting.meeting_time}</span>
                  <span>{meeting.location}</span>
                </div>
              </div>
            ))}
            {!filtered.length && <div style={{ color: 'var(--muted)' }}>No meetings match your filters.</div>}
          </div>
        </>
      )}

      {subTab === 'actions' && (
        <table className="table">
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
                <tr key={action.id} className={isOverdue(action.due_date, action.status) ? 'action-overdue' : isDueToday(action.due_date, action.status) ? 'action-due' : ''}>
                  <td>
                    {action.action_text}
                    {action.remarks && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{action.remarks}</div>}
                  </td>
                  <td>
                    <button className="btn ghost" onClick={() => setWorkspaceId(meeting.id)}>
                      {meeting.title}
                    </button>
                  </td>
                  <td>{action.assigned_to || '—'}</td>
                  <td>
                    {action.due_date || '—'}{' '}
                    {isOverdue(action.due_date, action.status) && <span className="pill cancel">Overdue</span>}
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
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No action items recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {subTab === 'decisions' && (
        <table className="table">
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
                  <button className="btn ghost" onClick={() => setWorkspaceId(meeting.id)}>
                    {meeting.title}
                  </button>
                </td>
                <td>{decision.decision_text}</td>
                <td>
                  <span className={`pill ${decision.outcome === 'Approved' ? 'done' : 'plan'}`}>{decision.outcome}</span>
                </td>
                <td>{decision.owner || '—'}</td>
              </tr>
            ))}
            {!allDecisions.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
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
