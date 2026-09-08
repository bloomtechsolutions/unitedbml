'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { CommitteeMemberOption } from '../events/types';
import type { MeetingRow } from '../../types/database';
import { localTodayIso } from './status';
import { MEETING_TYPES } from './types';
import type { MeetingWithChildren } from './types';
import { openActionsAcrossMeetings } from './useMeetings';

interface Values {
  title: string;
  meeting_type: string;
  meeting_date: string;
  meeting_time: string;
  location: string;
  chair: string;
  secretary: string;
  purpose: string;
}

const EMPTY: Values = {
  title: '',
  meeting_type: MEETING_TYPES[0],
  meeting_date: localTodayIso(),
  meeting_time: '15:00',
  location: '',
  chair: '',
  secretary: '',
  purpose: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  editing: MeetingRow | null;
  coordinators: CommitteeMemberOption[];
  allMeetings: MeetingWithChildren[];
  onSave: (payload: Partial<MeetingRow>, carryForwardIds: string[]) => Promise<void>;
}

export function MeetingFormModal({ open, onClose, editing, coordinators, allMeetings, onSave }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [carryForward, setCarryForward] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        title: editing.title,
        meeting_type: editing.meeting_type ?? MEETING_TYPES[0],
        meeting_date: editing.meeting_date ?? localTodayIso(),
        meeting_time: editing.meeting_time ?? '15:00',
        location: editing.location ?? '',
        chair: editing.chair ?? '',
        secretary: editing.secretary ?? '',
        purpose: editing.purpose ?? '',
      });
    } else {
      setValues(EMPTY);
    }
    setCarryForward(new Set());
    setError(null);
  }, [open, editing]);

  const candidateActions = editing ? [] : openActionsAcrossMeetings(allMeetings);

  const handleSubmit = async () => {
    if (!values.title.trim()) {
      setError('Meeting title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          title: values.title.trim(),
          meeting_type: values.meeting_type,
          meeting_date: values.meeting_date || null,
          meeting_time: values.meeting_time || null,
          location: values.location || null,
          chair: values.chair || null,
          secretary: values.secretary || null,
          purpose: values.purpose || null,
        },
        Array.from(carryForward)
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meeting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Meeting' : 'Schedule Meeting'}>
      <div className="form-grid">
        <div className="field full">
          <label>Title</label>
          <input value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={values.meeting_type} onChange={(e) => setValues((v) => ({ ...v, meeting_type: e.target.value }))}>
            {MEETING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Location</label>
          <input value={values.location} onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))} />
        </div>
        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={values.meeting_date}
            onChange={(e) => setValues((v) => ({ ...v, meeting_date: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Time</label>
          <input
            type="time"
            value={values.meeting_time}
            onChange={(e) => setValues((v) => ({ ...v, meeting_time: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Chair</label>
          <select value={values.chair} onChange={(e) => setValues((v) => ({ ...v, chair: e.target.value }))}>
            <option value="">Select chair</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.name ?? ''}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Secretary</label>
          <select value={values.secretary} onChange={(e) => setValues((v) => ({ ...v, secretary: e.target.value }))}>
            <option value="">Select secretary</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.name ?? ''}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Purpose</label>
          <textarea value={values.purpose} onChange={(e) => setValues((v) => ({ ...v, purpose: e.target.value }))} />
        </div>
      </div>

      {!editing && candidateActions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 750, color: '#4c556b' }}>
            Carry forward unresolved actions as agenda items
          </label>
          <div className="committee-member-picker" style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
            {candidateActions.map(({ meeting, action }) => (
              <label key={action.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={carryForward.has(action.id)}
                  onChange={(e) =>
                    setCarryForward((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(action.id);
                      else next.delete(action.id);
                      return next;
                    })
                  }
                />
                {action.action_text} — <small style={{ color: 'var(--muted)' }}>from {meeting.title}</small>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Meeting'}
        </button>
      </div>
    </Modal>
  );
}
