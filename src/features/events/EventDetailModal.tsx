"use client";

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import type { EventTaskRow } from '../../types/database';
import { useToast } from '../../lib/ToastContext';
import {
  daysUntilEvent,
  eventLifecycle,
  eventLifecycleAlert,
  eventPreparationProgress,
  eventReadiness,
} from './lifecycle';
import type { CommitteeMemberOption, EventWithChildren, StaffOption } from './types';
import { TaskFormModal } from './TaskFormModal';
import {
  deleteAttendance,
  deleteTask,
  upsertAttendance,
  upsertTask,
  updateEventAttendanceCount,
  useStaffSearch,
} from './useEvents';

type Tab = 'overview' | 'assignments' | 'attendance';

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
  const toast = useToast();

  if (!event) return null;

  const lifecycle = eventLifecycle(event, event.tasks);
  const readiness = eventReadiness(event, event.tasks);
  const alertText = eventLifecycleAlert(event, event.tasks);
  const prep = eventPreparationProgress(event.tasks);
  const days = daysUntilEvent(event);

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

  const addStaffToAttendance = async (staff: StaffOption) => {
    await upsertAttendance({
      event_id: event.id,
      staff_uid: staff.uid,
      staff_name: staff.full_name,
      contact_no: staff.contact_no,
      attendance_status: 'Pending',
      attended: false,
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

  const openTasks = event.tasks.filter((t) => !t.done);
  const overdueTasks = openTasks.filter((t) => t.due_date && t.due_date < new Date().toISOString().slice(0, 10));

  return (
    <Modal open onClose={onClose} title={event.name} wide>
      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={`tab ${tab === 'assignments' ? 'active' : ''}`} onClick={() => setTab('assignments')}>
          Assignments ({event.tasks.length})
        </button>
        <button className={`tab ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>
          Attendance ({event.attendance.length})
        </button>
      </div>

      {tab === 'overview' && (
        <div>
          <div className={`event-alert ${lifecycle === 'Ready' ? 'success' : lifecycle === 'Cancelled' ? 'danger' : 'warning'}`}>
            {alertText}
          </div>
          <div className="kpis" style={{ marginTop: 16 }}>
            <div className="kpi">
              <div className="lbl">Lifecycle</div>
              <strong>{lifecycle}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Readiness</div>
              <strong>{readiness}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Preparation</div>
              <strong>{prep}%</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Days Remaining</div>
              <strong>{days}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Expected Participants</div>
              <strong>{event.expected_participants}</strong>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <p>
              <b>Venue:</b> {event.venue || '—'} &nbsp; <b>Coordinator:</b> {event.coordinator || '—'}
            </p>
            <p>{event.description}</p>
            <p>
              Pending tasks: {openTasks.length} ({overdueTasks.length} overdue)
            </p>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => onEdit(event)}>
              Edit Event
            </button>
            {!event.archived && (
              <button className="btn ghost" onClick={() => void onArchive(event)}>
                Archive
              </button>
            )}
            {!event.cancelled_at && (
              <button className="btn ghost" onClick={() => void onCancel(event)}>
                Cancel Event
              </button>
            )}
            <button className="btn danger" onClick={() => void onDelete(event)}>
              Delete
            </button>
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div>
          <div className="toolbar">
            <div />
            <button
              className="btn primary"
              onClick={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
            >
              + Add Task
            </button>
          </div>
          <table className="table">
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
                  <td className="task-actions">
                    <button
                      className="btn ghost"
                      onClick={() => {
                        setEditingTask(task);
                        setTaskModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn danger" onClick={() => void removeTask(task)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!event.tasks.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No tasks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          <div className="toolbar">
            <input
              placeholder="Search staff to add…"
              value={staffQuery}
              onChange={(e) => setStaffQuery(e.target.value)}
              style={{ minWidth: 260 }}
            />
          </div>
          {staffQuery && (
            <div style={{ marginBottom: 12 }}>
              {staffResults.map((s) => (
                <button key={s.id} className="btn soft" style={{ marginRight: 8, marginBottom: 8 }} onClick={() => void addStaffToAttendance(s)}>
                  + {s.full_name}
                </button>
              ))}
              {!staffResults.length && <small style={{ color: 'var(--muted)' }}>No matching active staff.</small>}
            </div>
          )}
          <table className="table">
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
                    <button className="btn danger" onClick={() => void removeAttendance(row)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!event.attendance.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No attendance recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSave={saveTask}
        coordinators={coordinators}
        editing={editingTask}
      />
    </Modal>
  );
}