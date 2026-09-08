'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { StaffRow } from '../../types/database';
import { upsertStaffRows } from './useStaff';

interface Values {
  uid: string;
  name: string;
  jobTitle: string;
  division: string;
  department: string;
  unit: string;
  status: string;
}

const EMPTY: Values = { uid: '', name: '', jobTitle: '', division: '', department: '', unit: '', status: 'Active' };

interface Props {
  open: boolean;
  onClose: () => void;
  editing: StaffRow | null;
  onSaved: () => Promise<void>;
}

export function StaffEditModal({ open, onClose, editing, onSaved }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        uid: editing.uid,
        name: editing.full_name,
        jobTitle: editing.job_title ?? '',
        division: editing.division ?? '',
        department: editing.department ?? '',
        unit: editing.unit ?? '',
        status: editing.status,
      });
    } else {
      setValues(EMPTY);
    }
    setError(null);
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!values.uid.trim() || !values.name.trim()) {
      setError('UID and Name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertStaffRows([values]);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Staff Record' : 'Add Staff Record'}>
      <div className="form-grid">
        <div className="field">
          <label>UID</label>
          <input value={values.uid} disabled={!!editing} onChange={(e) => setValues((v) => ({ ...v, uid: e.target.value }))} />
        </div>
        <div className="field">
          <label>Name</label>
          <input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        </div>
        <div className="field">
          <label>Job Title</label>
          <input value={values.jobTitle} onChange={(e) => setValues((v) => ({ ...v, jobTitle: e.target.value }))} />
        </div>
        <div className="field">
          <label>Division</label>
          <input value={values.division} onChange={(e) => setValues((v) => ({ ...v, division: e.target.value }))} />
        </div>
        <div className="field">
          <label>Department</label>
          <input value={values.department} onChange={(e) => setValues((v) => ({ ...v, department: e.target.value }))} />
        </div>
        <div className="field">
          <label>Unit</label>
          <input value={values.unit} onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}>
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
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
