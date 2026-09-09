'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { CommitteeMemberRow, StaffRow } from '../../types/database';
import { COMMITTEE_AVAILABILITY_OPTIONS, COMMITTEE_STATUS_OPTIONS, type CommitteeTerm, type DirectoryUser } from './types';

interface Values {
  directoryId: string;
  name: string;
  contact: string;
  email: string;
  status: string;
  availability: string;
  leaveFrom: string;
  leaveTo: string;
  notes: string;
}

const EMPTY: Values = {
  directoryId: '',
  name: '',
  contact: '',
  email: '',
  status: 'Active',
  availability: 'Available',
  leaveFrom: '',
  leaveTo: '',
  notes: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  member: CommitteeMemberRow | null;
  directory: DirectoryUser[];
  assignedUserIds: Set<string>;
  term: CommitteeTerm | null;
  staffByUid: Map<string, StaffRow>;
  onSave: (payload: Partial<CommitteeMemberRow>) => Promise<void>;
}

export function MemberFormModal({ open, onClose, member, directory, assignedUserIds, term, staffByUid, onSave }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !member) return;
    setValues({
      directoryId: member.user_id ?? '',
      name: member.name ?? '',
      contact: member.contact ?? '',
      email: member.email ?? '',
      status: member.status || 'Active',
      availability: member.availability || 'Available',
      leaveFrom: member.leave_from ?? '',
      leaveTo: member.leave_to ?? '',
      notes: member.notes ?? '',
    });
    setError(null);
  }, [open, member]);

  if (!member) return null;

  const availableDirectory = directory.filter(
    (u) => u.id === member.user_id || !assignedUserIds.has(u.id)
  );

  const selectedDirectoryUser = directory.find((u) => u.id === values.directoryId);
  const selectedStaff = selectedDirectoryUser?.member_uid ? staffByUid.get(selectedDirectoryUser.member_uid) : undefined;

  const applyDirectoryUser = (id: string) => {
    const user = directory.find((u) => u.id === id);
    setValues((v) => ({
      ...v,
      directoryId: id,
      name: user?.full_name ?? v.name,
      contact: user?.contact_no ?? v.contact,
      email: user?.email ?? v.email,
    }));
  };

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setError('Assign a name (pick a user, or type one manually).');
      return;
    }
    if (values.availability === 'On Leave' && (!values.leaveFrom || !values.leaveTo)) {
      setError('Leave From and Leave To dates are required when availability is On Leave.');
      return;
    }
    const user = directory.find((u) => u.id === values.directoryId);
    setSaving(true);
    setError(null);
    try {
      await onSave({
        user_id: values.directoryId || null,
        staff_uid: user?.member_uid ?? member.staff_uid,
        uid: user?.member_uid ?? member.uid,
        name: values.name.trim(),
        contact: values.contact || null,
        email: values.email || null,
        term_start: term?.start ?? member.term_start,
        term_end: term?.end ?? member.term_end,
        status: values.status,
        availability: values.availability,
        leave_from: values.availability === 'On Leave' ? values.leaveFrom : null,
        leave_to: values.availability === 'On Leave' ? values.leaveTo : null,
        notes: values.notes || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Assign — ${member.role}`}>
      <div className="form-grid">
        <div className="field full">
          <label>UnitedBML User (optional — auto-fills contact details)</label>
          <select value={values.directoryId} onChange={(e) => applyDirectoryUser(e.target.value)}>
            <option value="">Manual entry</option>
            {availableDirectory.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </option>
            ))}
          </select>
          {selectedStaff && (
            <div className="committee-member-preview">
              <div className="mini">
                <small>Job Title</small>
                <b>{selectedStaff.job_title || '—'}</b>
              </div>
              <div className="mini">
                <small>Division</small>
                <b>{selectedStaff.division || '—'}</b>
              </div>
              <div className="mini">
                <small>Department</small>
                <b>{selectedStaff.department || '—'}</b>
              </div>
              <div className="mini">
                <small>Unit</small>
                <b>{selectedStaff.unit || '—'}</b>
              </div>
              <div className="mini">
                <small>Staff Master UID</small>
                <b>{selectedStaff.uid}</b>
              </div>
              <div className="mini">
                <small>Match Status</small>
                <b>Matched</b>
              </div>
            </div>
          )}
          {values.directoryId && !selectedStaff && (
            <div className="committee-loading">No Staff Master record matched for this user&apos;s UID/email yet.</div>
          )}
        </div>
        <div className="field">
          <label>Name</label>
          <input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        </div>
        <div className="field">
          <label>Contact</label>
          <input value={values.contact} onChange={(e) => setValues((v) => ({ ...v, contact: e.target.value }))} />
        </div>
        <div className="field full">
          <label>Email</label>
          <input value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}>
            {COMMITTEE_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Availability</label>
          <select
            value={values.availability}
            onChange={(e) => setValues((v) => ({ ...v, availability: e.target.value }))}
          >
            {COMMITTEE_AVAILABILITY_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        {values.availability === 'On Leave' && (
          <>
            <div className="field">
              <label>Leave From</label>
              <input
                type="date"
                value={values.leaveFrom}
                onChange={(e) => setValues((v) => ({ ...v, leaveFrom: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Leave To</label>
              <input
                type="date"
                value={values.leaveTo}
                onChange={(e) => setValues((v) => ({ ...v, leaveTo: e.target.value }))}
              />
            </div>
          </>
        )}
        <div className="field full">
          <label>Notes</label>
          <textarea value={values.notes} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} />
        </div>
      </div>
      {term && (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
          Term: {term.start} → {term.end} (set club-wide in Committee Term)
        </p>
      )}
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Assignment'}
        </button>
      </div>
    </Modal>
  );
}
