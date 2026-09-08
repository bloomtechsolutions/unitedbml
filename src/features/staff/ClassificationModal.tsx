'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { AUDIENCE_CATEGORIES } from './types';
import type { ClassificationRow } from './types';
import { saveClassification } from './useStaff';

interface Props {
  row: ClassificationRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ClassificationModal({ row, onClose, onSaved }: Props) {
  const [category, setCategory] = useState<string>('MALE_BASED');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setCategory(row.category ?? 'MALE_BASED');
    setNotes(row.notes ?? '');
    setError(null);
  }, [row]);

  if (!row) return null;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveClassification({ id: row.mappingId, matchType: row.matchType, value: row.value, category, notes });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save classification.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Classify ${row.matchType === 'UNIT' ? 'Unit' : 'Department'} — ${row.value}`}>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
        Unit overrides Department when both exist for a staff member.
      </p>
      <div className="form-grid">
        <div className="field">
          <label>Audience Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {AUDIENCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace('_', ' ')}
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
          {saving ? 'Saving…' : 'Save Classification'}
        </button>
      </div>
    </Modal>
  );
}
