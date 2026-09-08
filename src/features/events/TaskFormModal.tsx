"use client";

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { EventTaskRow } from '../../types/database';
import type { CommitteeMemberOption } from './types';
import { TASK_PRIORITIES } from './types';
import { localTodayIso } from './lifecycle';

function addDaysIso(days: number): string {
  const d = new Date(`${localTodayIso()}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (payload: { task_text: string; owner_id: string; due_date: string; priority: string; notes: string }) => Promise<void>;
  coordinators: CommitteeMemberOption[];
  editing?: EventTaskRow | null;
}

export function TaskFormModal({ open, onClose, onSave, coordinators, editing }: Props) {
  const [taskText, setTaskText] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueDate, setDueDate] = useState(addDaysIso(3));
  const [priority, setPriority] = useState<string>('Normal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTaskText(editing.task_text);
      setOwnerId(editing.owner_committee_id ?? '');
      setDueDate(editing.due_date ?? addDaysIso(3));
      setPriority(editing.priority ?? 'Normal');
      setNotes(editing.notes ?? '');
    } else {
      setTaskText('');
      setOwnerId('');
      setDueDate(addDaysIso(3));
      setPriority('Normal');
      setNotes('');
    }
    setError(null);
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!taskText.trim()) {
      setError('Task description is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ task_text: taskText.trim(), owner_id: ownerId, due_date: dueDate, priority, notes });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Task' : 'Add Task'}>
      <div className="form-grid">
        <div className="field full">
          <label>Task</label>
          <input value={taskText} onChange={(e) => setTaskText(e.target.value)} />
        </div>
        <div className="field">
          <label>Owner</label>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Unassigned</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Task'}
        </button>
      </div>
    </Modal>
  );
}