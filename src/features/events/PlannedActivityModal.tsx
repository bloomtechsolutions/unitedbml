'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { createPlannedActivity } from './useEventCalendar';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  onSaved: () => Promise<void>;
}

/** Quick-add for a planned activity that doesn't have a full Event yet — just enough to
 * hold its place on the calendar (name + date) until someone formalizes it via "Promote to Event". */
export function PlannedActivityModal({ open, onClose, defaultDate, onSaved }: Props) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDate(defaultDate);
      setNotes('');
      setError(null);
    }
  }, [open, defaultDate]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Enter a name for the planned activity.');
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createPlannedActivity({
        name: name.trim(),
        planned_date: date,
        notes: notes || null,
        created_by: profile?.id,
        created_by_name: profile?.full_name,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the planned activity.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Planned Activity">
      <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginTop: -6, marginBottom: 14 }}>
        A placeholder for something not set up as a full event yet — just a name and a date. Promote it to a
        real event later once details are confirmed.
      </p>
      <div className="field">
        <label>Activity Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Staff Team Building" />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Add to Calendar'}
        </button>
      </div>
    </Modal>
  );
}
