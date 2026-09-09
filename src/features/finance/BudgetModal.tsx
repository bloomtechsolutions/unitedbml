'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { BudgetRow } from '../../types/database';
import { saveBudget } from './useFinance';

interface Props {
  open: boolean;
  onClose: () => void;
  budget: BudgetRow | null;
  onSaved: () => Promise<void>;
}

export function BudgetModal({ open, onClose, budget, onSaved }: Props) {
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(budget?.approved_amount ?? 0);
      setNotes(budget?.notes ?? '');
      setError(null);
    }
  }, [open, budget]);

  const handleSubmit = async () => {
    if (amount < 0) {
      setError('Enter a valid budget amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveBudget({ category: 'Annual', approved_amount: amount, notes: notes || null });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the annual budget.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Annual Budget">
      <div className="field">
        <label>Annual Budget (MVR)</label>
        <input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Budget'}
        </button>
      </div>
    </Modal>
  );
}
