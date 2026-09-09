'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import type { EligibleExpenseRequest } from './types';
import { createProcurementGroup, sendProcurementGroupEmail } from './useReimbursements';

interface Props {
  request: EligibleExpenseRequest | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function ProcurementGroupModal({ request, onClose, onCreated }: Props) {
  const { profile } = useAuth();
  const [managerEmail, setManagerEmail] = useState('');
  const [headEmail, setHeadEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!request) return null;

  const total = request.lines.reduce((sum, l) => sum + l.amount, 0);

  const handleSubmit = async () => {
    if (!managerEmail.trim()) {
      setError('Procurement Manager email is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const actorName = profile?.full_name || profile?.email || 'Unknown';
    try {
      const group = await createProcurementGroup(request, managerEmail.trim(), headEmail.trim(), actorName);
      try {
        await sendProcurementGroupEmail(group, actorName, profile?.role || '', profile?.email || '');
      } catch (emailErr) {
        setError(
          `The pre-approval was saved, but the email could not be sent: ${emailErr instanceof Error ? emailErr.message : 'Unknown error'}. You can retry sending from the Procurement tab.`
        );
        setSaving(false);
        await onCreated();
        return;
      }
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Procurement pre-approval.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Procurement Pre-Approval — ${request.title || request.expenseRequestNumber}`}>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
        Procurement Manager and Head do not need UnitedBML access — enter their email addresses.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {request.lines.map((l) => (
            <tr key={l.lineNo}>
              <td>{l.description}</td>
              <td>{l.amount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontWeight: 700 }}>Total: {total.toLocaleString()}</p>

      <div className="form-grid">
        <div className="field">
          <label>Procurement Manager Email</label>
          <input type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Procurement Head Email (optional)</label>
          <input type="email" value={headEmail} onChange={(e) => setHeadEmail(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Send for Pre-Approval'}
        </button>
      </div>
    </Modal>
  );
}
