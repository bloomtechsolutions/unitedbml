'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import type { EligibleExpenseLine } from './types';
import { recordException } from './useReimbursements';

interface Props {
  line: EligibleExpenseLine | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function ExceptionModal({ line, onClose, onCreated }: Props) {
  const { profile } = useAuth();
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!line) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('A reason is required to bypass Procurement pre-approval.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordException(
        { expenseRequestId: line.expenseRequestId, expenseRequestNumber: line.expenseRequestNumber, eventId: line.eventId, eventName: line.eventName },
        line,
        reason.trim(),
        remarks,
        expectedDate,
        profile?.full_name || profile?.email || 'Unknown'
      );
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record exception.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Record Exception — ${line.description}`}>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
        This bypasses Procurement pre-approval entirely and makes the item immediately eligible for AP batch
        entry. Use only when Procurement approval genuinely cannot be obtained first.
      </p>
      <div className="form-grid">
        <div className="field full">
          <label>Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="field full">
          <label>Remarks (optional)</label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="field">
          <label>Expected Expense Date</label>
          <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Record Exception'}
        </button>
      </div>
    </Modal>
  );
}
