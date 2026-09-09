"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Modal } from '../../components/Modal';
import type { EventTaskRow } from '../../types/database';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { getEventApprovedBudget, getEventFinanceRequests, useEventFinanceSummary, useExpenseRequests } from '../finance/useFinance';
import { RequestDetailModal } from '../finance/RequestDetailModal';
import { RequestFormModal } from '../finance/RequestFormModal';
import type { ExpenseRequestWithLines } from '../finance/types';
import { ActualExpenseModal } from './ActualExpenseModal';
import {
  daysUntilEvent,
  eventLifecycle,
  eventLifecycleAlert,
  eventPreparationProgress,
  eventReadiness,
  type EventLifecycle,
} from './lifecycle';
import { buildEventTimeline } from './timeline';
import type { CommitteeMemberOption, EventWithChildren, StaffOption } from './types';
import { TaskFormModal } from './TaskFormModal';
import { syncTournamentAttendance, useLinkedTournament } from '../tournaments/useTournaments';
import {
  closeEventFinanceSettlement,
  deleteAttendance,
  deleteTask,
  recordActualExpense,
  upsertAttendance,
  upsertTask,
  updateEventAttendanceCount,
  useStaffSearch,
} from './useEvents';

type Tab = 'overview' | 'assignments' | 'timeline' | 'attendance' | 'budget';

const LIFECYCLE_STEPS: EventLifecycle[] = ['Planning', 'Ready', 'Event Day', 'Post-Event Settlement', 'Closed'];

const LIFECYCLE_PILL: Record<EventLifecycle, string> = {
  Planning: 'ub-pill-accent',
  Ready: 'ub-pill-success',
  'Event Day': 'ub-pill-gold',
  'Post-Event Settlement': 'ub-pill-warning',
  Closed: 'ub-pill-neutral',
  Cancelled: 'ub-pill-danger',
};

const TAG_PILL: Record<string, string> = {
  Meeting: 'ub-pill-info',
  Event: 'ub-pill-accent',
  Task: 'ub-pill-neutral',
  Finance: 'ub-pill-gold',
  Attendance: 'ub-pill-success',
};

interface Props {
  event: EventWithChildren | null;
  onClose: () => void;
  onEdit: (event: EventWithChildren) => void;
  onArchive: (event: EventWithChildren) => void;
  onCancel: (event: EventWithChildren) => void;
  onDelete: (event: EventWithChildren) => void;
  coordinators: CommitteeMemberOption[];
  onRefresh: () => Promise<void>;
}

export function EventDetailModal({ event, onClose, onEdit, onArchive, onCancel, onDelete, coordinators, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<EventTaskRow | null>(null);
  const [staffQuery, setStaffQuery] = useState('');
  const staffResults = useStaffSearch(staffQuery);
  const linkedTournament = useLinkedTournament(event?.id ?? '');
  const [syncing, setSyncing] = useState(false);
  const { statusByEvent: financeByEvent } = useEventFinanceSummary();
  const { requests: allRequests, reload: reloadRequests } = useExpenseRequests();
  const [viewingRequest, setViewingRequest] = useState<ExpenseRequestWithLines | null>(null);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [actualExpenseOpen, setActualExpenseOpen] = useState(false);
  const [closingSettlement, setClosingSettlement] = useState(false);
  const { isCommitteeUser } = useAuth();
  const toast = useToast();

  if (!event) return null;

  const finance = financeByEvent.get(event.id) ?? { hasApproved: false, hasPending: false };
  const lifecycle = eventLifecycle(event, event.tasks, finance);
  const readiness = eventReadiness(event, event.tasks, finance);
  const alertText = eventLifecycleAlert(event, event.tasks, finance);
  const prep = eventPreparationProgress(event.tasks);
  const days = daysUntilEvent(event);

  const financeRequests = getEventFinanceRequests(allRequests, event.id);
  const approvedBudget = getEventApprovedBudget(allRequests, event.id);
  const pendingBudget = financeRequests
    .filter((r) => r.status === 'Pending President Recommendation' || r.status === 'Pending Final Approval')
    .reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const variance = approvedBudget - (event.actual_expense_total || 0);
  const timeline = buildEventTimeline(event, event.tasks, financeRequests);

  const saveTask = async (payload: { task_text: string; owner_id: string; due_date: string; priority: string; notes: string }) => {
    const owner = coordinators.find((c) => c.id === payload.owner_id);
    await upsertTask({
      id: editingTask?.id,
      event_id: event.id,
      source_key: editingTask?.source_key ?? `task-${Date.now()}`,
      task_text: payload.task_text,
      owner: owner?.name ?? null,
      owner_role: owner?.role ?? null,
      owner_committee_id: owner?.id ?? null,
      due_date: payload.due_date || null,
      priority: payload.priority,
      notes: payload.notes || null,
      done: editingTask?.done ?? false,
    });
    await onRefresh();
    toast('Task saved');
  };

  const toggleTask = async (task: EventTaskRow) => {
    await upsertTask({ ...task, done: !task.done });
    await onRefresh();
  };

  const removeTask = async (task: EventTaskRow) => {
    if (!confirm(`Remove task "${task.task_text}"?`)) return;
    await deleteTask(task.id);
    await onRefresh();
    toast('Task removed');
  };

  const handleSyncTournamentAttendance = async () => {
    if (!linkedTournament) return;
    setSyncing(true);
    try {
      const result = await syncTournamentAttendance(event.id, linkedTournament.id);
      await onRefresh();
      toast(`Synced: ${result.added} added${result.flagged ? `, ${result.flagged} flagged` : ''}${result.removed ? `, ${result.removed} removed` : ''}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to sync tournament registrations.');
    } finally {
      setSyncing(false);
    }
  };

  const addStaffToAttendance = async (staff: StaffOption) => {
    await upsertAttendance({
      event_id: event.id,
      staff_uid: staff.uid,
      staff_name: staff.full_name,
      contact_no: staff.contact_no,
      attendance_status: 'Pending',
      attended: false,
      data: linkedTournament ? { source: 'Walk-in' } : undefined,
    });
    setStaffQuery('');
    await onRefresh();
    toast('Staff added to roster');
  };

  const toggleAttendance = async (row: EventWithChildren['attendance'][number]) => {
    await upsertAttendance({ ...row, attended: !row.attended, marked_at: new Date().toISOString() });
    const attendedCount = event.attendance.filter((a) => (a.id === row.id ? !row.attended : a.attended)).length;
    await updateEventAttendanceCount(event.id, attendedCount);
    await onRefresh();
  };

  const removeAttendance = async (row: EventWithChildren['attendance'][number]) => {
    if (!confirm(`Remove ${row.staff_name} from the roster?`)) return;
    await deleteAttendance(row.id);
    const attendedCount = event.attendance.filter((a) => a.id !== row.id && a.attended).length;
    await updateEventAttendanceCount(event.id, attendedCount);
    await onRefresh();
    toast('Removed from roster');
  };

  const handleSaveActualExpense = async (amount: number, remarks: string) => {
    await recordActualExpense(event.id, amount, remarks);
    await onRefresh();
    toast('Actual expenses recorded');
  };

  const handleCloseSettlement = async () => {
    setClosingSettlement(true);
    try {
      await closeEventFinanceSettlement(event.id);
      await onRefresh();
      toast('Finance settlement closed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to close settlement.');
    } finally {
      setClosingSettlement(false);
    }
  };

  const openTasks = event.tasks.filter((t) => !t.done);
  const overdueTasks = openTasks.filter((t) => t.due_date && t.due_date < new Date().toISOString().slice(0, 10));
  const dueSoonTasks = openTasks.filter((t) => t.due_date && t.due_date >= new Date().toISOString().slice(0, 10) && daysUntilEvent({ event_date: t.due_date }) <= 3);
  const completedTasks = event.tasks.filter((t) => t.done);

  const stepIndex = LIFECYCLE_STEPS.indexOf(lifecycle);

  return (
    <Modal open onClose={onClose} title="Event Workspace" wide>
      <div
        style={{
          borderRadius: 16,
          background: 'linear-gradient(120deg, var(--ub-ink), var(--ub-accent-dark))',
          color: '#fff',
          padding: '22px 26px',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12.5, opacity: 0.85 }}>
          {event.event_type || 'Event'} · {lifecycle}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '6px 0' }}>{event.name}</h2>
        <div style={{ fontSize: 13, opacity: 0.9, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>📅 {event.event_date || 'Date TBC'} · {event.event_time || ''}</span>
          <span>📍 {event.venue || 'Venue TBC'}</span>
          <span>👤 {event.coordinator || 'Unassigned'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <span className={`ub-pill ${LIFECYCLE_PILL[lifecycle]}`}>{lifecycle}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ub-btn ub-btn-ghost" onClick={() => onEdit(event)}>
            Edit Event
          </button>
          {!event.archived && (
            <button className="ub-btn ub-btn-ghost" onClick={() => void onArchive(event)}>
              Archive Event
            </button>
          )}
          {!event.cancelled_at && (
            <button className="ub-btn ub-btn-ghost" onClick={() => void onCancel(event)}>
              Cancel Event
            </button>
          )}
          <button className="ub-btn ub-btn-danger" onClick={() => void onDelete(event)}>
            Delete
          </button>
        </div>
      </div>

      <div className="ub-tabs">
        <button className={`ub-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={`ub-tab ${tab === 'assignments' ? 'active' : ''}`} onClick={() => setTab('assignments')}>
          Assignments ({event.tasks.length})
        </button>
        <button className={`ub-tab ${tab === 'timeline' ? 'active' : ''}`} onClick={() => setTab('timeline')}>
          Timeline
        </button>
        <button className={`ub-tab ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>
          Attendance ({event.attendance.length})
        </button>
        <button className={`ub-tab ${tab === 'budget' ? 'active' : ''}`} onClick={() => setTab('budget')}>
          Budget &amp; Expenses
        </button>
      </div>

      {tab === 'overview' && (
        <div>
          {approvedBudget > 0 && (
            <div className="ub-banner ub-banner-warning">
              Financial lock: this event has {financeRequests.filter((r) => r.status === 'Approved').length} approved expense
              request(s) totaling MVR {approvedBudget.toLocaleString()}. Archiving or cancelling the event will not change the
              approved financial figures — any budget release must be processed through Finance using Expense Reversal.
            </div>
          )}
          {lifecycle === 'Closed' && (
            <div className="ub-banner ub-banner-success">
              Activity automatically closed. Attendance is recorded and Finance settlement is closed.
            </div>
          )}
          {lifecycle !== 'Closed' && (
            <div className={`ub-banner ${lifecycle === 'Ready' ? 'ub-banner-success' : lifecycle === 'Cancelled' ? 'ub-banner-warning' : 'ub-banner-accent'}`}>
              {alertText}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginTop: 4 }}>
            <div className="ub-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Event Description</h3>
              <p style={{ fontSize: 13.5, color: 'var(--ub-ink-soft)', lineHeight: 1.6 }}>{event.description || 'No description added.'}</p>
              {event.source_meeting_id && (
                <div style={{ marginTop: 14, padding: 14, background: 'var(--ub-surface-2)', borderRadius: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Created From Meeting Agenda</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
                    <div>
                      <div style={{ color: 'var(--ub-ink-faint)' }}>Meeting Date</div>
                      <div style={{ fontWeight: 600 }}>{event.source_meeting_date || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--ub-ink-faint)' }}>Meeting Title</div>
                      <div style={{ fontWeight: 600 }}>{event.source_meeting_title || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--ub-ink-faint)' }}>Agenda</div>
                      <div style={{ fontWeight: 600 }}>{event.source_agenda_title || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--ub-ink-faint)' }}>Outcome</div>
                      <div style={{ fontWeight: 600 }}>{event.source_agenda_outcome || '—'}</div>
                    </div>
                  </div>
                  <Link
                    href={`/meetings?open=${event.source_meeting_id}`}
                    className="ub-btn ub-btn-ghost"
                    style={{ marginTop: 12, display: 'inline-flex', padding: '7px 14px', fontSize: 12.5 }}
                  >
                    Open Meeting
                  </Link>
                </div>
              )}
            </div>

            <div className="ub-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Event Snapshot</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Expected</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{event.expected_participants}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Preparation</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{prep}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Days Remaining</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{days}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Readiness</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{readiness}</div>
                </div>
              </div>
              {lifecycle !== 'Cancelled' ? (
                <div className="ub-track">
                  {LIFECYCLE_STEPS.map((step, idx) => (
                    <div key={step} className={`ub-step ${idx < stepIndex ? 'done' : ''} ${idx === stepIndex ? 'now' : ''}`}>
                      <div className="ub-step-bullet">{idx < stepIndex ? '✓' : idx + 1}</div>
                      <div className="ub-step-label">{step}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="ub-pill ub-pill-danger">Cancelled</span>
              )}
              <p style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)', marginTop: 14, lineHeight: 1.5 }}>
                Status is automatically determined from preparation tasks, Finance approvals, event date, attendance and Finance settlement.
              </p>
            </div>
          </div>

          <div className="ub-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Pending Tasks Summary</h3>
              <button className="ub-btn ub-btn-ghost" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={() => setTab('assignments')}>
                View Assignments
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Open Tasks</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{openTasks.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Overdue</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: overdueTasks.length ? 'var(--ub-danger-dark)' : undefined }}>{overdueTasks.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Due Soon</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{dueSoonTasks.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Completed</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {completedTasks.length}/{event.tasks.length}
                </div>
              </div>
            </div>
            {!openTasks.length && event.tasks.length > 0 && (
              <div className="ub-banner ub-banner-success" style={{ marginTop: 14, marginBottom: 0 }}>
                No pending tasks. All assigned activity responsibilities are completed.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              className="ub-btn ub-btn-primary"
              onClick={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
            >
              + Add Task
            </button>
          </div>
          <table className="ub-table">
            <thead>
              <tr>
                <th>Done</th>
                <th>Task</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Priority</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {event.tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <input type="checkbox" checked={task.done} onChange={() => void toggleTask(task)} />
                  </td>
                  <td>{task.task_text}</td>
                  <td>{task.owner || '—'}</td>
                  <td>{task.due_date || '—'}</td>
                  <td>{task.priority || '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="ub-btn ub-btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => setTab('timeline')}
                    >
                      Timeline
                    </button>
                    <button
                      className="ub-btn ub-btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => {
                        setEditingTask(task);
                        setTaskModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="ub-btn ub-btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => void removeTask(task)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!event.tasks.length && (
                <tr>
                  <td colSpan={6} className="ub-empty">
                    No tasks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'timeline' && (
        <div>
          <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginBottom: 16 }}>
            Event, task, finance, attendance and settlement history in one view.
          </p>
          {lifecycle !== 'Cancelled' && (
            <div className="ub-track" style={{ marginBottom: 22 }}>
              {LIFECYCLE_STEPS.map((step, idx) => (
                <div key={step} className={`ub-step ${idx < stepIndex ? 'done' : ''} ${idx === stepIndex ? 'now' : ''}`}>
                  <div className="ub-step-bullet">{idx < stepIndex ? '✓' : idx + 1}</div>
                  <div className="ub-step-label">{step}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {timeline.map((entry, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--ub-border-2)' }}>
                <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>{new Date(entry.at).toLocaleString()}</div>
                <div>
                  <span className={`ub-pill ${TAG_PILL[entry.tag] ?? 'ub-pill-neutral'}`} style={{ marginRight: 8 }}>
                    {entry.tag}
                  </span>
                  <b style={{ fontSize: 13.5 }}>{entry.title}</b>
                  {entry.detail && <div style={{ fontSize: 12.5, color: 'var(--ub-ink-soft)', marginTop: 3 }}>{entry.detail}</div>}
                </div>
              </div>
            ))}
            {!timeline.length && <p className="ub-empty">No activity recorded yet.</p>}
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          {linkedTournament && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', margin: 0 }}>
                Linked to a Tournament — sync approved registrations into this roster, or add walk-ins below.
              </p>
              <button className="ub-btn ub-btn-primary" style={{ padding: '7px 14px', fontSize: 12.5 }} disabled={syncing} onClick={() => void handleSyncTournamentAttendance()}>
                {syncing ? 'Syncing…' : 'Sync Registrations'}
              </button>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <input
              placeholder={linkedTournament ? 'Search staff to add as walk-in…' : 'Search staff to add…'}
              value={staffQuery}
              onChange={(e) => setStaffQuery(e.target.value)}
              style={{ minWidth: 260 }}
            />
          </div>
          {staffQuery && (
            <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {staffResults.map((s) => (
                <button key={s.id} className="ub-btn ub-btn-ghost" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={() => void addStaffToAttendance(s)}>
                  + {s.full_name}
                </button>
              ))}
              {!staffResults.length && <small style={{ color: 'var(--ub-ink-faint)' }}>No matching active staff.</small>}
            </div>
          )}
          <table className="ub-table">
            <thead>
              <tr>
                <th>Attended</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {event.attendance.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input type="checkbox" checked={row.attended} onChange={() => void toggleAttendance(row)} />
                  </td>
                  <td>{row.staff_name}</td>
                  <td>{row.contact_no || '—'}</td>
                  <td>{row.attendance_status}</td>
                  <td>
                    <button className="ub-btn ub-btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => void removeAttendance(row)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!event.attendance.length && (
                <tr>
                  <td colSpan={5} className="ub-empty">
                    No attendance recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'budget' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
            <div className="ub-card ub-kpi">
              <div className="ub-kpi-value">MVR {(event.planned_budget || 0).toLocaleString()}</div>
              <div className="ub-kpi-label">Planned Budget</div>
            </div>
            <div className="ub-card ub-kpi">
              <div className="ub-kpi-value">MVR {approvedBudget.toLocaleString()}</div>
              <div className="ub-kpi-label">Approved Budget</div>
            </div>
            <div className="ub-card ub-kpi">
              <div className="ub-kpi-value">MVR {(event.actual_expense_total || 0).toLocaleString()}</div>
              <div className="ub-kpi-label">Actual Expense</div>
            </div>
            <div className="ub-card ub-kpi">
              <div className="ub-kpi-value" style={{ color: variance < 0 ? 'var(--ub-danger-dark)' : 'var(--ub-success-dark)' }}>
                MVR {variance.toLocaleString()}
              </div>
              <div className="ub-kpi-label">Approved vs Actual</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
            <div className="ub-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>Finance Expense Requests</h3>
                  <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginTop: 3 }}>Synced automatically from the Finance module.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ub-btn ub-btn-ghost" style={{ padding: '8px 14px', fontSize: 12.5 }} onClick={() => setNewRequestOpen(true)}>
                    + Expense Request
                  </button>
                  <button className="ub-btn ub-btn-primary" style={{ padding: '8px 14px', fontSize: 12.5 }} onClick={() => setActualExpenseOpen(true)}>
                    Actual Expenses
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {financeRequests.map((req) => (
                  <div key={req.id} className="ub-card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <b style={{ fontSize: 13.5 }}>{req.request_number ?? req.id}</b>
                        <div style={{ fontSize: 12.5, color: 'var(--ub-ink-soft)', marginTop: 2 }}>{req.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)', marginTop: 4 }}>
                          {req.request_date || req.created_at?.slice(0, 10)} · {req.requested_by} {req.requester_role ? `· ${req.requester_role}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>MVR {(req.total_amount ?? 0).toLocaleString()}</div>
                        <span
                          className={`ub-pill ${req.status === 'Approved' ? 'ub-pill-success' : req.status === 'Rejected' ? 'ub-pill-danger' : 'ub-pill-warning'}`}
                          style={{ marginTop: 6 }}
                        >
                          {req.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="ub-btn ub-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setViewingRequest(req)}>
                        Open Finance Request
                      </button>
                      {(req.president_comment || req.final_approver_comment) && (
                        <button
                          className="ub-btn ub-btn-ghost"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => alert([req.president_comment, req.final_approver_comment].filter(Boolean).join('\n\n'))}
                        >
                          Approval Note
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!financeRequests.length && <p className="ub-empty">No expense requests linked to this event yet.</p>}
              </div>
            </div>

            <div className="ub-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Financial Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ub-ink-faint)' }}>Planned Event Budget</span>
                  <b>MVR {(event.planned_budget || 0).toLocaleString()}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ub-ink-faint)' }}>Total Requests</span>
                  <b>{financeRequests.length}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ub-ink-faint)' }}>Pending Approval</span>
                  <b>MVR {pendingBudget.toLocaleString()}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ub-ink-faint)' }}>Approved Budget</span>
                  <b>MVR {approvedBudget.toLocaleString()}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ub-ink-faint)' }}>Actual Expense</span>
                  <b>MVR {(event.actual_expense_total || 0).toLocaleString()}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ub-ink-faint)' }}>Approved vs Actual Variance</span>
                  <b style={{ color: variance < 0 ? 'var(--ub-danger-dark)' : 'var(--ub-success-dark)' }}>MVR {variance.toLocaleString()}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--ub-ink-faint)' }}>Finance Settlement</span>
                  <span className={`ub-pill ${event.finance_settlement_status === 'Closed' ? 'ub-pill-success' : 'ub-pill-neutral'}`}>
                    {event.finance_settlement_status || 'Pending Actuals'}
                  </span>
                </div>
              </div>

              {isCommitteeUser && event.finance_settlement_status !== 'Closed' && (
                <button
                  className="ub-btn ub-btn-primary"
                  style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
                  onClick={() => void handleCloseSettlement()}
                  disabled={closingSettlement || !event.actual_entered_at}
                >
                  {closingSettlement ? 'Closing…' : 'Close Finance Settlement'}
                </button>
              )}
              {!event.actual_entered_at && isCommitteeUser && event.finance_settlement_status !== 'Closed' && (
                <p style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)', marginTop: 8 }}>Enter actual expenses before closing settlement.</p>
              )}

              <div style={{ marginTop: 16, padding: 12, background: 'var(--ub-surface-2)', borderRadius: 10, fontSize: 11.5, color: 'var(--ub-ink-faint)', lineHeight: 1.5 }}>
                Approved Budget remains the authorization record. Actual Expense can be entered by any signed-in user after the
                event and is used for Exco reporting.
              </div>
            </div>
          </div>
        </div>
      )}

      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSave={saveTask}
        coordinators={coordinators}
        editing={editingTask}
      />
      <RequestDetailModal
        request={viewingRequest}
        onClose={() => setViewingRequest(null)}
        onRefresh={async () => {
          await reloadRequests();
          await onRefresh();
        }}
      />
      <RequestFormModal
        open={newRequestOpen}
        onClose={() => setNewRequestOpen(false)}
        defaultEventId={event.id}
        onCreated={async () => {
          await reloadRequests();
          await onRefresh();
          toast('Expense request created');
        }}
      />
      <ActualExpenseModal event={actualExpenseOpen ? event : null} onClose={() => setActualExpenseOpen(false)} onSave={handleSaveActualExpense} />
    </Modal>
  );
}
