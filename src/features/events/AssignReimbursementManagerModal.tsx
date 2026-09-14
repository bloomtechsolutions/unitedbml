'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../lib/ToastContext';
import { updateEvent } from './useEvents';
import type { CommitteeMemberOption } from './types';

interface Props {
  open: boolean;
  eventId: string;
  currentCommitteeId: string | null;
  members: CommitteeMemberOption[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function AssignReimbursementManagerModal({ open, eventId, currentCommitteeId, members, onClose, onSaved }: Props) {
  const toast = useToast();
  const [memberId, setMemberId] = useState(currentCommitteeId ?? '');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const member = members.find((m) => m.id === memberId) ?? null;
      await updateEvent(eventId, {
        reimbursement_manager: member?.name ?? null,
        reimbursement_manager_role: member?.role ?? null,
        reimbursement_manager_committee_id: member?.id ?? null,
      });
      toast(member ? `${member.name} assigned as Reimbursement Manager` : 'Reimbursement Manager cleared');
      await onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to assign Reimbursement Manager.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Assign Reimbursement Manager">
      <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginBottom: 14 }}>
        For events run outside UnitedBML (e.g. staff competing in an external tournament), the assigned Reimbursement
        Manager can submit AP bills for this event's approved expenses, but another committee member must review the
        submission before it is sent to Accounts Payable.
      </p>
      <div className="field">
        <label>Reimbursement Manager</label>
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.role}
            </option>
          ))}
        </select>
      </div>
      <div className="modal-actions">
        <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="ub-btn ub-btn-primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
