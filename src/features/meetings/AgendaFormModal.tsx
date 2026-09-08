'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { CommitteeMemberOption } from '../events/types';
import type { MeetingAgendaRow } from '../../types/database';

interface Values {
  title: string;
  owner: string;
  minutes_allocated: number;
  outcome: string;
  details: string;
  discussion: string;
}

const EMPTY: Values = { title: '', owner: '', minutes_allocated: 10, outcome: '', details: '', discussion: '' };

interface Props {
  open: boolean;
  onClose: () => void;
  editing: MeetingAgendaRow | null;
  coordinators: CommitteeMemberOption[];
  nextSortOrder: number;
  onSave: (payload: Partial<MeetingAgendaRow>) => Promise<void>;
}

export function AgendaFormModal({ open, onClose, editing, coordinators, nextSortOrder, onSave }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        title: editing.title,
        owner: editing.owner ?? '',
        minutes_allocated: editing.minutes_allocated,
        outcome: editing.outcome ?? '',
        details: editing.details ?? '',
        discussion: editing.discussion ?? '',
      });
    } else {
      setValues(EMPTY);
    }
    setError(null);
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!values.title.trim()) {
      setError('Agenda title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: values.title.trim(),
        owner: values.owner || null,
        minutes_allocated: Number(values.minutes_allocated) || 0,
        outcome: values.outcome || null,
        details: values.details || null,
        discussion: values.discussion || null,
        sort_order: editing?.sort_order ?? nextSortOrder,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agenda item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Agenda Item' : 'Add Agenda Item'}>
      <div className="form-grid">
        <div className="field full">
          <label>Title</label>
          <input value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} />
        </div>
        <div className="field">
          <label>Owner</label>
          <select value={values.owner} onChange={(e) => setValues((v) => ({ ...v, owner: e.target.value }))}>
            <option value="">Unassigned</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.name ?? ''}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Minutes Allocated</label>
          <input
            type="number"
            min={0}
            value={values.minutes_allocated}
            onChange={(e) => setValues((v) => ({ ...v, minutes_allocated: Number(e.target.value) }))}
          />
        </div>
        <div className="field full">
          <label>Outcome</label>
          <input
            list="agenda-outcomes"
            value={values.outcome}
            onChange={(e) => setValues((v) => ({ ...v, outcome: e.target.value }))}
            placeholder="e.g. Approved, Noted, Create Event / Activity"
          />
          <datalist id="agenda-outcomes">
            <option value="Approved" />
            <option value="Noted" />
            <option value="Deferred" />
            <option value="Rejected" />
            <option value="Create Event / Activity" />
          </datalist>
        </div>
        <div className="field full">
          <label>Details</label>
          <textarea value={values.details} onChange={(e) => setValues((v) => ({ ...v, details: e.target.value }))} />
        </div>
        <div className="field full">
          <label>Discussion</label>
          <textarea
            value={values.discussion}
            onChange={(e) => setValues((v) => ({ ...v, discussion: e.target.value }))}
          />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Agenda Item'}
        </button>
      </div>
    </Modal>
  );
}
