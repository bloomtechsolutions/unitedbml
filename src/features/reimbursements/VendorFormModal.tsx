'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { VendorMasterRow } from '../../types/database';
import { saveVendor } from './useReimbursements';

interface Props {
  open: boolean;
  vendor: VendorMasterRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  /** Prefills Name when creating a new vendor from elsewhere in the app (e.g. an AP bill's
   * Vendor field with no match yet) — ignored when editing an existing vendor. */
  initialName?: string;
}

export function VendorFormModal({ open, vendor, onClose, onSaved, initialName }: Props) {
  const [vendorAccount, setVendorAccount] = useState('');
  const [name, setName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [status, setStatus] = useState('Active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setVendorAccount(vendor?.vendor_account ?? '');
      setName(vendor?.name ?? initialName ?? '');
      setWorkerId(vendor?.worker_id ?? '');
      setStatus(vendor?.status ?? 'Active');
      setError(null);
    }
  }, [open, vendor, initialName]);

  if (!open) return null;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveVendor({ vendorAccount, name, workerId, status }, !vendor);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vendor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={vendor ? `Edit Vendor — ${vendor.vendor_account}` : 'Add Vendor'}>
      <div className="form-grid">
        <div className="field">
          <label>Vendor Account</label>
          <input value={vendorAccount} onChange={(e) => setVendorAccount(e.target.value)} disabled={!!vendor} />
        </div>
        <div className="field">
          <label>Name (Staff Member)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Worker ID / Staff UID</label>
          <input value={workerId} onChange={(e) => setWorkerId(e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Vendor'}
        </button>
      </div>
    </Modal>
  );
}
