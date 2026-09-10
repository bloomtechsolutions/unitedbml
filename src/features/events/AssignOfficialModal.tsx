'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { supabase } from '../../lib/supabase';
import { assignExternalOfficial } from '../portal/usePortal';

interface Props {
  open: boolean;
  eventId: string;
  onClose: () => void;
}

export function AssignOfficialModal({ open, eventId, onClose }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Official');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleAssign = async () => {
    if (!email.trim() || !profile) return;
    setSaving(true);
    try {
      const { data: match, error } = await supabase.from('profiles').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
      if (error || !match) throw new Error('No account found with that email.');
      await assignExternalOfficial(eventId, match.id, role, profile.id);
      toast('Official assigned — they can now submit a reimbursement claim from My Hub.');
      setEmail('');
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to assign official.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Assign External Official">
      <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginBottom: 14 }}>
        Assigns an existing account (e.g. a hired referee/scorer) to this event so they can submit their own reimbursement
        claim for Committee to approve under Reimbursements → External.
      </p>
      <div className="form-grid">
        <div className="field">
          <label>Email (existing account)</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div className="field">
          <label>Role</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Referee, Scorer" />
        </div>
      </div>
      <div className="modal-actions">
        <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="ub-btn ub-btn-primary" disabled={saving || !email.trim()} onClick={() => void handleAssign()}>
          {saving ? 'Assigning…' : 'Assign Official'}
        </button>
      </div>
    </Modal>
  );
}
