'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../lib/ToastContext';
import { supabase } from '../../lib/supabase';
import { updateEvent } from './useEvents';

const COMMITTEE_ROLES = new Set([
  'administrator',
  'chairperson',
  'vice chairperson',
  'vice_chairperson',
  'president',
  'treasurer',
  'secretary',
  'communications coordinator',
  'male coordinator 1',
  'male coordinator 2',
  'atoll coordinator',
  'atoll representative',
  'head of total rewards & employee relations',
  'head of talent acquisition & people development',
  'head of employee experience & hr business partnering',
]);

interface Candidate {
  userId: string;
  name: string;
  roleLabel: string;
  group: 'Committee' | 'Staff';
}

function useCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('committee_members').select('user_id,name,role').eq('status', 'Active').not('user_id', 'is', null),
      supabase.from('profiles').select('id,full_name,role').eq('status', 'Active'),
    ]).then(([committeeRes, profilesRes]) => {
      if (!active) return;
      const committee: Candidate[] = (committeeRes.data ?? [])
        .filter((m): m is { user_id: string; name: string | null; role: string } => !!m.user_id)
        .map((m) => ({ userId: m.user_id, name: m.name || 'Unnamed', roleLabel: m.role, group: 'Committee' as const }));
      const committeeUserIds = new Set(committee.map((c) => c.userId));
      const staff: Candidate[] = (profilesRes.data ?? [])
        .filter((p) => !committeeUserIds.has(p.id) && !COMMITTEE_ROLES.has((p.role || '').trim().toLowerCase()))
        .map((p) => ({ userId: p.id, name: p.full_name || 'Unnamed', roleLabel: 'Staff Member', group: 'Staff' as const }));
      setCandidates([...committee, ...staff].sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { candidates, loading };
}

interface Props {
  open: boolean;
  eventId: string;
  currentUserId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function AssignReimbursementManagerModal({ open, eventId, currentUserId, onClose, onSaved }: Props) {
  const toast = useToast();
  const { candidates, loading } = useCandidates();
  const [userId, setUserId] = useState(currentUserId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUserId(currentUserId ?? '');
  }, [currentUserId, open]);

  if (!open) return null;

  const committeeOptions = candidates.filter((c) => c.group === 'Committee');
  const staffOptions = candidates.filter((c) => c.group === 'Staff');

  const handleSave = async () => {
    setSaving(true);
    try {
      const picked = candidates.find((c) => c.userId === userId) ?? null;
      await updateEvent(eventId, {
        reimbursement_manager: picked?.name ?? null,
        reimbursement_manager_role: picked?.roleLabel ?? null,
        reimbursement_manager_user_id: picked?.userId ?? null,
      });
      toast(picked ? `${picked.name} assigned as Reimbursement Manager` : 'Reimbursement Manager cleared');
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
        submission before it is sent to Accounts Payable. Any active account can be assigned, not only committee
        members.
      </p>
      <div className="field">
        <label>Reimbursement Manager</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={loading}>
          <option value="">Unassigned</option>
          {committeeOptions.length > 0 && (
            <optgroup label="Committee">
              {committeeOptions.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.name} — {c.roleLabel}
                </option>
              ))}
            </optgroup>
          )}
          {staffOptions.length > 0 && (
            <optgroup label="Staff">
              {staffOptions.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.name} — {c.roleLabel}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="modal-actions">
        <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="ub-btn ub-btn-primary" disabled={saving || loading} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
