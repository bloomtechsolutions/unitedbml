'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { CommitteeTerm } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  term: CommitteeTerm | null;
  onSave: (start: string, end: string) => Promise<void>;
}

export function TermModal({ open, onClose, term, onSave }: Props) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStart(term?.start ?? '');
    setEnd(term?.end ?? '');
    setError(null);
  }, [open, term]);

  const handleSubmit = async () => {
    if (!start || !end) {
      setError('Both a start and end date are required.');
      return;
    }
    if (end < start) {
      setError('Term end must be on or after the start date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(start, end);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the Committee term.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Committee Term">
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
        This term applies club-wide and is written onto every currently-assigned committee member.
      </p>
      <div className="form-grid">
        <div className="field">
          <label>Term Start</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>Term End</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Term'}
        </button>
      </div>
    </Modal>
  );
}
