'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { CommitteeMemberOption } from '../events/types';
import type { MeetingActionRow, MeetingAgendaRow, MeetingDecisionRow } from '../../types/database';
import { AgendaFormModal } from './AgendaFormModal';
import { ActionFormModal } from './ActionFormModal';
import { DecisionFormModal } from './DecisionFormModal';
import { buildMinutesHtml, printMeetingMinutes } from './minutes';
import { isDueToday, isOverdue, meetingStatus } from './status';
import { ATTENDANCE_STATUSES } from './types';
import type { MeetingStatus, MeetingWithChildren } from './types';
import {
  checkInToMeeting,
  createEventFromAgendaItem,
  deleteAction,
  deleteAgendaItem,
  deleteDecision,
  notifyMeetingAttendees,
  recordActionHistory,
  saveAction,
  saveAgendaItem,
  saveDecision,
  toggleMinutesFinalized,
  updateAttendeeStatus,
  useMyCommitteeMemberId,
} from './useMeetings';

type Tab = 'overview' | 'agenda' | 'attendance' | 'decisions' | 'actions' | 'minutes';

const STATUS_PILL: Record<MeetingStatus, string> = {
  Scheduled: 'ub-pill-warning',
  'In Progress': 'ub-pill-accent',
  'Minutes Pending': 'ub-pill-gold',
  Completed: 'ub-pill-success',
  Cancelled: 'ub-pill-neutral',
};

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
  const [editingDecision, setEditingDecision] = useState<MeetingDecisionRow | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<MeetingActionRow | null>(null);
  const [quickAddAgendaId, setQuickAddAgendaId] = useState<string | undefined>(undefined);
  const [checkingIn, setCheckingIn] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const toast = useToast();
  const { session } = useAuth();
  const myCommitteeId = useMyCommitteeMemberId(session?.user.id);

  if (!meeting) return null;

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await checkInToMeeting(meeting.id);
      await onRefresh();
      toast("You're checked in");
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to check in.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleNotifyAttendees = async () => {
    setNotifying(true);
    try {
      const result = await notifyMeetingAttendees(meeting.id);
      toast(`Notified ${result.notified} attendee${result.notified === 1 ? '' : 's'}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to notify attendees.');
    } finally {
      setNotifying(false);
    }
  };

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
      <div style={{ marginBottom: 18 }}>
        <span className={`ub-pill ${STATUS_PILL[status]}`}>{status}</span>
        <h2 style={{ fontSize: 19, fontWeight: 700, marginTop: 8 }}>{meeting.title}</h2>
        <div style={{ fontSize: 12.5, color: 'var(--ub-ink-soft)', marginTop: 4 }}>
          {meeting.meeting_date} · {meeting.meeting_time} · {meeting.location} · Chair: {meeting.chair || '—'}
        </div>
      </div>

      <div className="ub-tabs">
        {(['overview', 'agenda', 'attendance', 'decisions', 'actions', 'minutes'] as Tab[]).map((t) => (
          <button key={t} className={`ub-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
            <div className="ub-card ub-kpi">
              <div className="ub-kpi-value">{meeting.agenda.length}</div>
              <div className="ub-kpi-label">Agenda Items</div>
            </div>
            <div className="ub-card ub-kpi">
              <div className="ub-kpi-value">{openActions.length}</div>
              <div className="ub-kpi-label">Open Actions</div>
            </div>
            <div className="ub-card ub-kpi">
              <div className="ub-kpi-value" style={{ color: overdueActions.length ? 'var(--ub-danger-dark)' : undefined }}>{overdueActions.length}</div>
              <div className="ub-kpi-label">Overdue Actions</div>
            </div>
            <div className="ub-card ub-kpi">
              <div className="ub-kpi-value">{meeting.decisions.length}</div>
              <div className="ub-kpi-label">Decisions</div>
            </div>
          </div>
          <p style={{ marginTop: 18, fontSize: 13.5, color: 'var(--ub-ink-soft)', lineHeight: 1.6 }}>{meeting.purpose}</p>
          <div className="modal-actions">
            <button className="ub-btn ub-btn-ghost" onClick={() => onEdit(meeting)}>
              Edit Meeting
            </button>
            <button className="ub-btn ub-btn-ghost" onClick={() => void handleToggleMinutes()}>
              {meeting.minutes_finalized ? 'Reopen Minutes' : 'Finalize Minutes'}
            </button>
            <button className="ub-btn ub-btn-ghost" onClick={() => void handleNotifyAttendees()} disabled={notifying}>
              {notifying ? 'Notifying…' : 'Notify Attendees'}
            </button>
            {!meeting.cancelled && (
              <button className="ub-btn ub-btn-danger" onClick={() => onCancel(meeting)}>
                Cancel Meeting
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'agenda' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              className="ub-btn ub-btn-primary"
              onClick={() => {
                setEditingAgenda(null);
                setAgendaModalOpen(true);
              }}
            >
              + Add Agenda Item
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meeting.agenda.map((item) => {
              const requiredItems = (item.data as { requiredItems?: { id: string; description: string; category: string; estimatedAmount: number; reimbursable: boolean }[] } | null)?.requiredItems ?? [];
              const itemDecisions = meeting.decisions.filter((d) => d.agenda_id === item.id);
              const itemActions = meeting.actions.filter((a) => a.agenda_id === item.id);
              return (
                <div key={item.id} className="ub-card" style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{item.title}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {item.carry_forward && <span className="ub-pill ub-pill-warning">Needs Discussion</span>}
                        {item.owner && <span className="ub-pill ub-pill-neutral">{item.owner}</span>}
                        {item.outcome && <span className="ub-pill ub-pill-neutral">{item.outcome}</span>}
                        {item.outcome === 'Create Event / Activity' && !item.created_event_id && (
                          <span className="ub-pill ub-pill-warning">Pending Event Creation</span>
                        )}
                        {item.created_event_id && <span className="ub-pill ub-pill-success">Event Created ✓</span>}
                      </div>
                      {item.discussion && <p style={{ fontSize: 12.5, color: 'var(--ub-ink-soft)', margin: '10px 0 0', lineHeight: 1.5 }}>{item.discussion}</p>}
                    </div>
                  </div>

                  {requiredItems.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--ub-surface-2)', borderRadius: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ub-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
                        Items required for this event
                      </div>
                      {requiredItems.map((ri) => (
                        <div key={ri.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}>
                          <span>
                            {ri.description} {ri.category && <span style={{ color: 'var(--ub-ink-faint)' }}>· {ri.category}</span>}
                          </span>
                          <span style={{ color: 'var(--ub-ink-faint)' }}>{ri.estimatedAmount ? `MVR ${ri.estimatedAmount}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(itemDecisions.length > 0 || itemActions.length > 0) && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {itemDecisions.map((d) => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                          <span className={`ub-pill ${d.outcome === 'Approved' ? 'ub-pill-success' : 'ub-pill-accent'}`} style={{ padding: '2px 9px', fontSize: 10.5 }}>
                            Decision
                          </span>
                          {d.decision_text}
                        </div>
                      ))}
                      {itemActions.map((a) => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                          <span className="ub-pill ub-pill-neutral" style={{ padding: '2px 9px', fontSize: 10.5 }}>
                            Action · {a.status}
                          </span>
                          {a.action_text}
                          {a.assigned_to && <span style={{ color: 'var(--ub-ink-faint)' }}>— {a.assigned_to}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    <button
                      className="ub-btn ub-btn-ghost"
                      style={{ padding: '7px 14px', fontSize: 12.5 }}
                      onClick={() => {
                        setEditingAgenda(item);
                        setAgendaModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    {item.outcome === 'Create Event / Activity' && !item.created_event_id && (
                      <button
                        className="ub-btn"
                        style={{ padding: '7px 14px', fontSize: 12.5, background: 'var(--ub-accent-soft)', color: 'var(--ub-accent-dark)' }}
                        onClick={() => void handleCreateEvent(item)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ub-accent-dark)" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
                        Create Event
                      </button>
                    )}
                    <button
                      className="ub-btn ub-btn-ghost"
                      style={{ padding: '7px 14px', fontSize: 12.5 }}
                      onClick={() => {
                        setEditingDecision(null);
                        setQuickAddAgendaId(item.id);
                        setDecisionModalOpen(true);
                      }}
                    >
                      + Decision
                    </button>
                    <button
                      className="ub-btn ub-btn-ghost"
                      style={{ padding: '7px 14px', fontSize: 12.5 }}
                      onClick={() => {
                        setEditingAction(null);
                        setQuickAddAgendaId(item.id);
                        setActionModalOpen(true);
                      }}
                    >
                      + Action
                    </button>
                    <button className="ub-btn ub-btn-danger" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={() => void handleDeleteAgenda(item)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            {!meeting.agenda.length && <p className="ub-empty">No agenda items yet.</p>}
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          {myCommitteeId && (() => {
            const mine = meeting.attendees.find((a) => a.committee_id === myCommitteeId);
            if (!mine) return null;
            const alreadyIn = mine.attendance_status === 'Present';
            return (
              <div className={`ub-banner ${alreadyIn ? 'ub-banner-success' : 'ub-banner-accent'}`}>
                {alreadyIn ? (
                  <>✓ You're checked in to this meeting.</>
                ) : (
                  <>
                    You're expected at this meeting.
                    <button
                      className="ub-btn ub-btn-primary"
                      style={{ marginLeft: 'auto', padding: '7px 16px', fontSize: 12.5 }}
                      onClick={() => void handleCheckIn()}
                      disabled={checkingIn}
                    >
                      {checkingIn ? 'Checking in…' : 'Check In'}
                    </button>
                  </>
                )}
              </div>
            );
          })()}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {meeting.attendees.map((attendee) => (
              <div key={attendee.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', borderBottom: '1px solid var(--ub-border)' }}>
                <div>
                  <b style={{ fontSize: 13.5 }}>
                    {attendee.attendee_name}
                    {attendee.committee_id === myCommitteeId && <span style={{ color: 'var(--ub-accent-dark)', fontWeight: 600 }}> (you)</span>}
                  </b>
                  <small style={{ display: 'block', color: 'var(--ub-ink-faint)', marginTop: 2 }}>{attendee.attendee_role}</small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="ub-pill ub-pill-neutral">{attendee.attendance_status}</span>
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
            {!meeting.attendees.length && <p className="ub-empty">No attendees seated yet.</p>}
          </div>
        </div>
      )}

      {tab === 'decisions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              className="ub-btn ub-btn-primary"
              onClick={() => {
                setEditingDecision(null);
                setQuickAddAgendaId(undefined);
                setDecisionModalOpen(true);
              }}
            >
              + Record Decision
            </button>
          </div>
          <table className="ub-table">
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
                    <span className={`ub-pill ${d.outcome === 'Approved' ? 'ub-pill-success' : 'ub-pill-accent'}`}>{d.outcome}</span>
                  </td>
                  <td>{d.owner || '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="ub-btn ub-btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => {
                        setEditingDecision(d);
                        setQuickAddAgendaId(undefined);
                        setDecisionModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="ub-btn ub-btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => void handleDeleteDecision(d)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!meeting.decisions.length && (
                <tr>
                  <td colSpan={4} className="ub-empty">
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              className="ub-btn ub-btn-primary"
              onClick={() => {
                setEditingAction(null);
                setQuickAddAgendaId(undefined);
                setActionModalOpen(true);
              }}
            >
              + Add Action
            </button>
          </div>
          <table className="ub-table">
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
                  className={isOverdue(a.due_date, a.status) ? 'ub-row-overdue' : isDueToday(a.due_date, a.status) ? 'ub-row-due' : ''}
                >
                  <td>{a.action_text}</td>
                  <td>{a.assigned_to || '—'}</td>
                  <td>
                    {a.due_date || '—'} {isOverdue(a.due_date, a.status) && <span className="ub-pill ub-pill-danger">Overdue</span>}
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
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="ub-btn ub-btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => {
                        setEditingAction(a);
                        setActionModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="ub-btn ub-btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => void handleDeleteAction(a)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!meeting.actions.length && (
                <tr>
                  <td colSpan={5} className="ub-empty">
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="ub-btn ub-btn-primary" onClick={() => printMeetingMinutes(meeting)}>
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
        editing={editingDecision}
        defaultAgendaId={quickAddAgendaId}
        agendaItems={meeting.agenda}
        coordinators={coordinators}
        onSave={handleSaveDecision}
      />
      <ActionFormModal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        editing={editingAction}
        defaultAgendaId={quickAddAgendaId}
        agendaItems={meeting.agenda}
        coordinators={coordinators}
        onSave={handleSaveAction}
      />
    </Modal>
  );
}
