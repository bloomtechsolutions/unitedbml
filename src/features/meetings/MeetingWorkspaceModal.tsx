'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../lib/ToastContext';
import type { CommitteeMemberOption } from '../events/types';
import type { MeetingActionRow, MeetingAgendaRow, MeetingDecisionRow } from '../../types/database';
import { AgendaFormModal } from './AgendaFormModal';
import { ActionFormModal } from './ActionFormModal';
import { DecisionFormModal } from './DecisionFormModal';
import { buildMinutesHtml, printMeetingMinutes } from './minutes';
import { isDueToday, isOverdue, meetingStatus } from './status';
import { ATTENDANCE_STATUSES } from './types';
import type { MeetingWithChildren } from './types';
import {
  createEventFromAgendaItem,
  deleteAction,
  deleteAgendaItem,
  deleteDecision,
  recordActionHistory,
  saveAction,
  saveAgendaItem,
  saveDecision,
  toggleMinutesFinalized,
  updateAttendeeStatus,
} from './useMeetings';

type Tab = 'overview' | 'agenda' | 'attendance' | 'decisions' | 'actions' | 'minutes';

interface Props {
  meeting: MeetingWithChildren | null;
  onClose: () => void;
  onEdit: (meeting: MeetingWithChildren) => void;
  onCancel: (meeting: MeetingWithChildren) => void;
  coordinators: CommitteeMemberOption[];
  onRefresh: () => Promise<void>;
}

export function MeetingWorkspaceModal({ meeting, onClose, onEdit, onCancel, coordinators, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<MeetingAgendaRow | null>(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<MeetingActionRow | null>(null);
  const toast = useToast();

  if (!meeting) return null;

  const status = meetingStatus(meeting);
  const openActions = meeting.actions.filter((a) => a.status !== 'Completed');
  const overdueActions = meeting.actions.filter((a) => isOverdue(a.due_date, a.status));

  const handleSaveAgenda = async (payload: Partial<MeetingAgendaRow>) => {
    await saveAgendaItem({ ...payload, id: editingAgenda?.id, meeting_id: meeting.id });
    await onRefresh();
    toast('Agenda item saved');
  };

  const handleDeleteAgenda = async (item: MeetingAgendaRow) => {
    if (!confirm(`Remove agenda item "${item.title}"?`)) return;
    await deleteAgendaItem(item.id);
    await onRefresh();
    toast('Agenda item removed');
  };

  const handleCreateEvent = async (item: MeetingAgendaRow) => {
    try {
      await createEventFromAgendaItem(meeting, item);
      await onRefresh();
      toast('Event created from agenda item — open it from Events & Activities');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create event.');
    }
  };

  const handleSaveDecision = async (payload: Partial<MeetingDecisionRow>) => {
    await saveDecision({ ...payload, meeting_id: meeting.id });
    await onRefresh();
    toast('Decision recorded');
  };

  const handleDeleteDecision = async (decision: MeetingDecisionRow) => {
    if (!confirm('Remove this decision?')) return;
    await deleteDecision(decision.id);
    await onRefresh();
    toast('Decision removed');
  };

  const handleSaveAction = async (payload: Partial<MeetingActionRow>, statusChanged: boolean) => {
    const id = await saveAction({ ...payload, id: editingAction?.id, meeting_id: meeting.id }, meeting);
    if (statusChanged && editingAction) {
      await recordActionHistory({
        meeting_action_id: id,
        action: 'status_change',
        old_status: editingAction.status,
        new_status: payload.status ?? null,
        remarks: payload.remarks ?? null,
      });
    }
    await onRefresh();
    toast('Action saved');
  };

  const handleQuickStatus = async (action: MeetingActionRow, newStatus: string) => {
    await saveAction({ ...action, status: newStatus, done: newStatus === 'Completed' }, meeting);
    await recordActionHistory({
      meeting_action_id: action.id,
      action: 'status_change',
      old_status: action.status,
      new_status: newStatus,
    });
    await onRefresh();
  };

  const handleDeleteAction = async (action: MeetingActionRow) => {
    if (!confirm('Remove this action item?')) return;
    await deleteAction(action.id);
    await onRefresh();
    toast('Action removed');
  };

  const handleAttendance = async (attendeeId: string, value: string) => {
    await updateAttendeeStatus(attendeeId, value);
    await onRefresh();
  };

  const handleToggleMinutes = async () => {
    await toggleMinutesFinalized(meeting.id, !meeting.minutes_finalized);
    await onRefresh();
    toast(meeting.minutes_finalized ? 'Minutes reopened' : 'Minutes finalized');
  };

  return (
    <Modal open onClose={onClose} title={meeting.title} wide>
      <div className="meeting-workspace-head">
        <span className={`meeting-status ${status.replace(/\s/g, '')}`}>{status}</span>
        <h2 style={{ marginTop: 8 }}>{meeting.title}</h2>
        <div className="meta">
          <span>{meeting.meeting_date}</span>
          <span>{meeting.meeting_time}</span>
          <span>{meeting.location}</span>
          <span>Chair: {meeting.chair || '—'}</span>
        </div>
      </div>

      <div className="tabs">
        {(['overview', 'agenda', 'attendance', 'decisions', 'actions', 'minutes'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="meeting-stat-grid">
            <div className="meeting-stat">
              <small>Agenda Items</small>
              <strong>{meeting.agenda.length}</strong>
            </div>
            <div className="meeting-stat">
              <small>Open Actions</small>
              <strong>{openActions.length}</strong>
            </div>
            <div className="meeting-stat">
              <small>Overdue Actions</small>
              <strong>{overdueActions.length}</strong>
            </div>
            <div className="meeting-stat">
              <small>Decisions</small>
              <strong>{meeting.decisions.length}</strong>
            </div>
          </div>
          <p style={{ marginTop: 16 }}>{meeting.purpose}</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => onEdit(meeting)}>
              Edit Meeting
            </button>
            <button className="btn ghost" onClick={() => void handleToggleMinutes()}>
              {meeting.minutes_finalized ? 'Reopen Minutes' : 'Finalize Minutes'}
            </button>
            {!meeting.cancelled && (
              <button className="btn danger" onClick={() => onCancel(meeting)}>
                Cancel Meeting
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'agenda' && (
        <div>
          <div className="toolbar">
            <div />
            <button
              className="btn primary"
              onClick={() => {
                setEditingAgenda(null);
                setAgendaModalOpen(true);
              }}
            >
              + Add Agenda Item
            </button>
          </div>
          {meeting.agenda.map((item) => (
            <div key={item.id} className="committee-detail-row" style={{ gridTemplateColumns: '1fr', borderTop: '1px dashed #e7ebf2', padding: '10px 0' }}>
              <div>
                <b>{item.title}</b>{' '}
                {item.carry_forward && <span className="meeting-link">Needs Discussion</span>}
                {item.owner && <span className="meeting-link">{item.owner}</span>}
                {item.outcome && <span className="meeting-link">{item.outcome}</span>}
                {item.outcome === 'Create Event / Activity' && !item.created_event_id && (
                  <span className="meeting-link" style={{ background: '#fff4db', color: '#946000' }}>
                    Pending Event Creation
                  </span>
                )}
                {item.created_event_id && (
                  <span className="meeting-link" style={{ background: '#eafaf2', color: '#17825a' }}>
                    Event Created ✓
                  </span>
                )}
                {item.discussion && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0' }}>{item.discussion}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setEditingAgenda(item);
                      setAgendaModalOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  {item.outcome === 'Create Event / Activity' && !item.created_event_id && (
                    <button className="btn soft" onClick={() => void handleCreateEvent(item)}>
                      + Create Event
                    </button>
                  )}
                  <button className="btn danger" onClick={() => void handleDeleteAgenda(item)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!meeting.agenda.length && <p style={{ color: 'var(--muted)' }}>No agenda items yet.</p>}
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          {meeting.attendees.map((attendee) => (
            <div key={attendee.id} className="meeting-attendance-row">
              <div>
                <b>{attendee.attendee_name}</b>
                <small style={{ display: 'block', color: 'var(--muted)' }}>{attendee.attendee_role}</small>
              </div>
              <div className="meeting-attendance-control">
                <span className={`meeting-attendance-state ${attendee.attendance_status}`}>{attendee.attendance_status}</span>
                <select
                  value={attendee.attendance_status ?? 'Expected'}
                  onChange={(e) => void handleAttendance(attendee.id, e.target.value)}
                >
                  {ATTENDANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {!meeting.attendees.length && <p style={{ color: 'var(--muted)' }}>No attendees seated yet.</p>}
        </div>
      )}

      {tab === 'decisions' && (
        <div>
          <div className="toolbar">
            <div />
            <button className="btn primary" onClick={() => setDecisionModalOpen(true)}>
              + Record Decision
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Decision</th>
                <th>Outcome</th>
                <th>Responsible</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {meeting.decisions.map((d) => (
                <tr key={d.id}>
                  <td>{d.decision_text}</td>
                  <td>
                    <span className={`pill ${d.outcome === 'Approved' ? 'done' : 'plan'}`}>{d.outcome}</span>
                  </td>
                  <td>{d.owner || '—'}</td>
                  <td>
                    <button className="btn danger" onClick={() => void handleDeleteDecision(d)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!meeting.decisions.length && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No decisions recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'actions' && (
        <div>
          <div className="toolbar">
            <div />
            <button
              className="btn primary"
              onClick={() => {
                setEditingAction(null);
                setActionModalOpen(true);
              }}
            >
              + Add Action
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Assigned To</th>
                <th>Due</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {meeting.actions.map((a) => (
                <tr
                  key={a.id}
                  className={isOverdue(a.due_date, a.status) ? 'action-overdue' : isDueToday(a.due_date, a.status) ? 'action-due' : ''}
                >
                  <td>{a.action_text}</td>
                  <td>{a.assigned_to || '—'}</td>
                  <td>
                    {a.due_date || '—'} {isOverdue(a.due_date, a.status) && <span className="pill cancel">Overdue</span>}
                  </td>
                  <td>
                    <select value={a.status} onChange={(e) => void handleQuickStatus(a, e.target.value)}>
                      {['Open', 'In Progress', 'Completed', 'Deferred'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="task-actions">
                    <button
                      className="btn ghost"
                      onClick={() => {
                        setEditingAction(a);
                        setActionModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn danger" onClick={() => void handleDeleteAction(a)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!meeting.actions.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No action items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'minutes' && (
        <div>
          <div className="toolbar">
            <div />
            <button className="btn primary" onClick={() => printMeetingMinutes(meeting)}>
              Print / Export
            </button>
          </div>
          <div dangerouslySetInnerHTML={{ __html: buildMinutesHtml(meeting) }} />
        </div>
      )}

      <AgendaFormModal
        open={agendaModalOpen}
        onClose={() => setAgendaModalOpen(false)}
        editing={editingAgenda}
        coordinators={coordinators}
        nextSortOrder={meeting.agenda.length}
        onSave={handleSaveAgenda}
      />
      <DecisionFormModal
        open={decisionModalOpen}
        onClose={() => setDecisionModalOpen(false)}
        agendaItems={meeting.agenda}
        coordinators={coordinators}
        onSave={handleSaveDecision}
      />
      <ActionFormModal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        editing={editingAction}
        coordinators={coordinators}
        onSave={handleSaveAction}
      />
    </Modal>
  );
}
