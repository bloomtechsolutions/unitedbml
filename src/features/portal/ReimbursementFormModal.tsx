'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import type { OfficialAssignment } from './types';
import { submitExternalReimbursement } from './usePortal';

interface Props {
  open: boolean;
  assignments: OfficialAssignment[];
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}

export function ReimbursementFormModal({ open, assignments, onClose, onSubmitted }: Props) {
  const [eventId, setEventId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [amount, setAmount] = useState(0);
  const [supportingDocumentName, setSupportingDocumentName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEventId('');
    setTitle('');
    setDescription('');
    setExpenseDate('');
    setVendorName('');
    setReferenceNo('');
    setAmount(0);
    setSupportingDocumentName('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!eventId || !title.trim() || !expenseDate || amount <= 0) {
      setError('Event, title, expense date, and a positive amount are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitExternalReimbursement({ eventId, title: title.trim(), description, expenseDate, vendorName, referenceNo, amount, supportingDocumentName });
      reset();
      onClose();
      await onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit reimbursement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit Reimbursement">
      <div className="form-grid">
        <div className="field full">
          <label>Event</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Select an event you are assigned to</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.event_id}>
                {a.eventName} ({a.official_role})
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Expense Date</label>
          <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Amount</label>
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Vendor</label>
          <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
        </div>
        <div className="field">
          <label>Reference No.</label>
          <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </div>
        <div className="field full">
          <label>Supporting Document (name/reference — bills are attached during AP submission)</label>
          <input value={supportingDocumentName} onChange={(e) => setSupportingDocumentName(e.target.value)} />
        </div>
        <div className="field full">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit for Committee Approval'}
        </button>
      </div>
    </Modal>
  );
}
