'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { EventRow } from '../../types/database';

interface Props {
  event: EventRow | null;
  onClose: () => void;
  onSave: (amount: number, remarks: string) => Promise<void>;
}

export function ActualExpenseModal({ event, onClose, onSave }: Props) {
  const [amount, setAmount] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    setAmount(event.actual_expense_total || 0);
    setRemarks(event.actual_expense_remarks || '');
    setError(null);
  }, [event]);

  if (!event) return null;

  const handleSubmit = async () => {
    if (amount <= 0) {
      setError('Enter a valid actual expense amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(amount, remarks);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save actual expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(event)} onClose={onClose} title="Record Actual Expenses">
      <p style={{ fontSize: 13, color: 'var(--ub-ink-faint)', marginBottom: 16 }}>
        What was actually spent on this event, for Exco reporting. Any signed-in user can enter this — the
        approved budget above remains the authorization record and is not changed by this figure.
      </p>
      <div className="ub-field" style={{ marginBottom: 14 }}>
        <label>Actual Expense (MVR)</label>
        <input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
      <div className="ub-field">
        <label>Remarks</label>
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
      {error && <div style={{ color: 'var(--ub-danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="ub-btn ub-btn-primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Actual Expenses'}
        </button>
      </div>
    </Modal>
  );
}
