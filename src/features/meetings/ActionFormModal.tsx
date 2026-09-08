'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import type { CommitteeMemberOption } from '../events/types';
import type { MeetingActionRow, MeetingAgendaRow } from '../../types/database';
import { localTodayIso } from './status';
import { ACTION_PRIORITIES, ACTION_STATUSES } from './types';

interface Values {
  action_text: string;
  assigned_to: string;
  due_date: string;
  priority: string;
  status: string;
  remarks: string;
  event_id: string;
  agenda_id: string;
}

function addDaysIso(days: number): string {
  const d = new Date(`${localTodayIso()}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY: Values = {
  action_text: '',
  assigned_to: '',
  due_date: addDaysIso(7),
  priority: 'Normal',
  status: 'Open',
  remarks: '',
  event_id: '',
  agenda_id: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  editing: MeetingActionRow | null;
  defaultAgendaId?: string;
  agendaItems: MeetingAgendaRow[];
  coordinators: CommitteeMemberOption[];
  onSave: (payload: Partial<MeetingActionRow>, statusChanged: boolean) => Promise<void>;
}

export function ActionFormModal({ open, onClose, editing, defaultAgendaId, agendaItems, coordinators, onSave }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('events')
      .select('id,name')
      .eq('archived', false)
      .order('name', { ascending: true })
      .then(({ data }) => setEvents(data ?? []));
    if (editing) {
      setValues({
        action_text: editing.action_text,
        assigned_to: editing.assigned_to ?? '',
        due_date: editing.due_date ?? addDaysIso(7),
        priority: editing.priority ?? 'Normal',
        status: editing.status,
        remarks: editing.remarks ?? '',
        event_id: editing.event_id ?? '',
        agenda_id: editing.agenda_id ?? '',
      });
    } else {
      setValues({ ...EMPTY, agenda_id: defaultAgendaId ?? '' });
    }
    setError(null);
  }, [open, editing, defaultAgendaId]);

  const handleSubmit = async () => {
    if (!values.action_text.trim()) {
      setError('Action description is required.');
      return;
    }
    const owner = coordinators.find((c) => c.name === values.assigned_to);
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          action_text: values.action_text.trim(),
          assigned_to: values.assigned_to || null,
          assigned_role: owner?.role ?? null,
          due_date: values.due_date || null,
          priority: values.priority,
          status: values.status,
          done: values.status === 'Completed',
          remarks: values.remarks || null,
          event_id: values.event_id || null,
          agenda_id: values.agenda_id || null,
        },
        editing ? editing.status !== values.status : false
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save action.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Update Action' : 'Add Action Item'}>
      <div className="form-grid">
        <div className="field full">
          <label>Action</label>
          <textarea
            value={values.action_text}
            onChange={(e) => setValues((v) => ({ ...v, action_text: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Assigned To</label>
          <select value={values.assigned_to} onChange={(e) => setValues((v) => ({ ...v, assigned_to: e.target.value }))}>
            <option value="">Unassigned</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.name ?? ''}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Due Date</label>
          <input type="date" value={values.due_date} onChange={(e) => setValues((v) => ({ ...v, due_date: e.target.value }))} />
        </div>
        <div className="field">
          <label>Priority</label>
          <select value={values.priority} onChange={(e) => setValues((v) => ({ ...v, priority: e.target.value }))}>
            {ACTION_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}>
            {ACTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Related Agenda Item</label>
          <select value={values.agenda_id} onChange={(e) => setValues((v) => ({ ...v, agenda_id: e.target.value }))}>
            <option value="">None</option>
            {agendaItems.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Linked Event (optional)</label>
          <select value={values.event_id} onChange={(e) => setValues((v) => ({ ...v, event_id: e.target.value }))}>
            <option value="">None</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Remarks</label>
          <textarea value={values.remarks} onChange={(e) => setValues((v) => ({ ...v, remarks: e.target.value }))} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Action'}
        </button>
      </div>
    </Modal>
  );
}
