'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import type { ProcurementGroupCase } from './types';
import { recordProcurementResponse } from './useReimbursements';

interface Props {
  group: ProcurementGroupCase | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ProcurementResponseModal({ group, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const [decision, setDecision] = useState<'Approved' | 'Rejected'>('Approved');
  const [comment, setComment] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group) return null;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await recordProcurementResponse(group, decision, comment, profile?.full_name || profile?.email || 'Unknown', file);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record Procurement response.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Record Procurement Response — ${group.case_ref}`}>
      <div className="form-grid">
        <div className="field">
          <label>Decision</label>
          <select value={decision} onChange={(e) => setDecision(e.target.value as 'Approved' | 'Rejected')}>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <div className="field full">
          <label>Comment</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div className="field full">
          <label>Evidence (Procurement's reply — .msg, .eml, .pdf, .png, .jpg)</label>
          <input
            type="file"
            accept=".msg,.eml,.pdf,.png,.jpg,.jpeg,message/rfc822,application/vnd.ms-outlook,application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      {decision === 'Approved' && (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Approving will split this pre-approval into {group.items.length} individual reimbursement case
          {group.items.length === 1 ? '' : 's'}, one per item, ready for AP batch entry.
        </p>
      )}
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Response'}
        </button>
      </div>
    </Modal>
  );
}
