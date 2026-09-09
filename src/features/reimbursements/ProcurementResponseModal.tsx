'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { ProcurementGroupCase } from './types';
import { recordProcurementResponse } from './useReimbursements';

const MAX_EVIDENCE_MB = 15;

interface Props {
  group: ProcurementGroupCase | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ProcurementResponseModal({ group, onClose, onSaved }: Props) {
  const [decision, setDecision] = useState<'Approved' | 'Rejected'>('Approved');
  const [responseDate, setResponseDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (group) {
      setDecision('Approved');
      setResponseDate(new Date().toISOString().slice(0, 10));
      setFile(null);
      setError(null);
    }
  }, [group]);

  if (!group) return null;

  const respondedBy = [group.procurement_manager_email, group.procurement_head_email].filter(Boolean).join('; ') || '—';

  const handleFileChange = (f: File | null) => {
    if (f && f.size > MAX_EVIDENCE_MB * 1024 * 1024) {
      setError(`Evidence file must be ${MAX_EVIDENCE_MB} MB or smaller.`);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await recordProcurementResponse(group, decision, responseDate, file);
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
        <div className="field">
          <label>Response Date</label>
          <input type="date" value={responseDate} onChange={(e) => setResponseDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Approved / Rejected By</label>
          <input value={respondedBy} readOnly />
        </div>
        <div className="field">
          <label>Email Reference / Subject</label>
          <input value={group.email_reference ?? '—'} readOnly />
        </div>
        <div className="field full">
          <label>Procurement Response Attachment (.msg, .eml, .pdf, .png, .jpg — max {MAX_EVIDENCE_MB} MB)</label>
          <input
            type="file"
            accept=".msg,.eml,.pdf,.png,.jpg,.jpeg,message/rfc822,application/vnd.ms-outlook,application/pdf,image/png,image/jpeg"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
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
