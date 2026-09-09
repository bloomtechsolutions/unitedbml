'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import type { ReconciliationLine } from './types';
import { createContingencyRequest } from './useSettlements';

interface Props {
  line: (ReconciliationLine & { eventId: string | null; eventName: string | null; available: number }) | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function ContingencyRequestModal({ line, onClose, onCreated }: Props) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!line) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    if (amount <= 0 || amount > line.available + 0.01) {
      setError(`Enter an amount up to the available contingency reserve (MVR ${line.available.toLocaleString()}).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createContingencyRequest({
        eventId: line.eventId,
        eventName: line.eventName,
        expenseRequestId: line.expenseRequestId,
        expenseRequestNumber: line.expenseRequestNumber,
        lineIndex: line.lineIndex,
        expenseItem: line.expenseItem,
        originalApprovedAmount: line.originalApprovedAmount,
        requestedAmount: amount,
        reason: reason.trim(),
        requestedByName: profile?.full_name || profile?.email || 'Unknown',
        requestedByRole: profile?.role || '',
        requestedByEmail: profile?.email || '',
        requestedById: profile?.id || '',
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit contingency request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Request Contingency Use — ${line.expenseItem}`}>
      <p style={{ fontSize: 12, color: 'var(--ub-ink-faint, #6b7280)', marginTop: -4 }}>
        Draws from the 5% contingency reserve on this expense request. Available: MVR {line.available.toLocaleString()}.
      </p>
      <div className="ub-field" style={{ marginBottom: 14 }}>
        <label>Requested Amount (MVR)</label>
        <input type="number" min={0} max={line.available} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
      <div className="ub-field">
        <label>Reason</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <div style={{ color: 'var(--ub-danger, #dc2626)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="ub-btn ub-btn-primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit for President Recommendation'}
        </button>
      </div>
    </Modal>
  );
}
