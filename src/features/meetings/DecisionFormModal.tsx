'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { CommitteeMemberOption } from '../events/types';
import type { MeetingAgendaRow, MeetingDecisionRow } from '../../types/database';

interface Values {
  decision_text: string;
  outcome: string;
  owner: string;
  agenda_id: string;
}

const EMPTY: Values = { decision_text: '', outcome: 'Approved', owner: '', agenda_id: '' };

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: MeetingDecisionRow | null;
  defaultAgendaId?: string;
  agendaItems: MeetingAgendaRow[];
  coordinators: CommitteeMemberOption[];
  onSave: (payload: Partial<MeetingDecisionRow>) => Promise<void>;
}

export function DecisionFormModal({ open, onClose, editing, defaultAgendaId, agendaItems, coordinators, onSave }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        decision_text: editing.decision_text,
        outcome: editing.outcome ?? 'Approved',
        owner: editing.owner ?? '',
        agenda_id: editing.agenda_id ?? '',
      });
    } else {
      setValues({ ...EMPTY, agenda_id: defaultAgendaId ?? '' });
    }
    setError(null);
  }, [open, editing, defaultAgendaId]);

  const handleSubmit = async () => {
    if (!values.decision_text.trim()) {
      setError('Decision text is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: editing?.id,
        decision_text: values.decision_text.trim(),
        outcome: values.outcome || null,
        owner: values.owner || null,
        agenda_id: values.agenda_id || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save decision.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Decision' : 'Record Decision'}>
      <div className="form-grid">
        <div className="field full">
          <label>Decision</label>
          <textarea
            value={values.decision_text}
            onChange={(e) => setValues((v) => ({ ...v, decision_text: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Outcome</label>
          <select value={values.outcome} onChange={(e) => setValues((v) => ({ ...v, outcome: e.target.value }))}>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Deferred">Deferred</option>
            <option value="Noted">Noted</option>
          </select>
        </div>
        <div className="field">
          <label>Responsible</label>
          <select value={values.owner} onChange={(e) => setValues((v) => ({ ...v, owner: e.target.value }))}>
            <option value="">Unassigned</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.name ?? ''}>
                {c.name} ({c.role})
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
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Decision'}
        </button>
      </div>
    </Modal>
  );
}
