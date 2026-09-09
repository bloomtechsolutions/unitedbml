'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { AP_BATCH_STATUSES } from './types';
import type { ApBatchWithBills } from './types';
import { batchHistory, updateApBatchStatus } from './useReimbursements';

interface Props {
  batch: ApBatchWithBills | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const GUIDANCE: Record<string, string> = {
  'Sent to AP': 'The batch email has been sent and is awaiting acknowledgement.',
  Processing: 'AP has received the batch and is processing payment.',
  Paid: 'Payment has been made — this amount now counts as actual spend in Finance settlement.',
  'Returned / Query': 'AP returned the batch with a query — add remarks explaining what is needed.',
  Cancelled: 'The batch is cancelled and excluded from submitted/remaining totals.',
};

export function ApStatusModal({ batch, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const [status, setStatus] = useState(batch?.status ?? 'Sent to AP');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!batch) return null;

  const handleSubmit = async () => {
    if (status === 'Returned / Query' && !remarks.trim()) {
      setError('Remarks are required when returning a batch with a query.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateApBatchStatus(batch, status, remarks, profile?.full_name || profile?.email || 'Unknown');
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Update AP Status — ${batch.submission_ref}`}>
      <div className="form-grid">
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {AP_BATCH_STATUSES.filter((s) => s !== 'Draft').map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Remarks</label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      </div>
      {GUIDANCE[status] && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{GUIDANCE[status]}</p>}

      {batchHistory(batch).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Status History</div>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {[...batchHistory(batch)]
              .reverse()
              .map((h, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--muted)', padding: '4px 0', borderBottom: '1px solid var(--line, #eee)' }}>
                  <b>{h.status}</b> — {new Date(h.at).toLocaleString()}
                  {h.actorName ? ` · ${h.actorName}` : ''}
                  {h.remarks ? ` · ${h.remarks}` : ''}
                </div>
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
          {saving ? 'Saving…' : 'Update Status'}
        </button>
      </div>
    </Modal>
  );
}
