'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { TournamentRegistrationRow, TournamentTeamRow, TournamentWinnerRow } from '../../types/database';
import { saveWinner } from './useTournaments';

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  isTeamsMode: boolean;
  teams: TournamentTeamRow[];
  registrations: TournamentRegistrationRow[];
  existingCategories: string[];
  onSaved: () => Promise<void>;
}

export function WinnerFormModal({ open, onClose, tournamentId, isTeamsMode, teams, registrations, existingCategories, onSaved }: Props) {
  const [position, setPosition] = useState('');
  const [awardType, setAwardType] = useState<'Team' | 'Individual'>(isTeamsMode ? 'Team' : 'Individual');
  const [teamId, setTeamId] = useState('');
  const [memberKey, setMemberKey] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPosition('');
      setAwardType(isTeamsMode ? 'Team' : 'Individual');
      setTeamId('');
      setMemberKey('');
      setRemarks('');
      setError(null);
    }
  }, [open, isTeamsMode]);

  if (!open) return null;

  const approvedMembers = (forTeamId: string) =>
    registrations.filter((r) => r.status === 'Approved' && (!isTeamsMode || !forTeamId || r.team_id === forTeamId));

  const handleSubmit = async () => {
    if (!position.trim()) {
      setError('Result / Award category is required.');
      return;
    }
    let payload: Partial<TournamentWinnerRow>;
    if (isTeamsMode) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) {
        setError('Select a team.');
        return;
      }
      if (awardType === 'Team') {
        payload = { winner_name: team.team_name, team_id: team.id, staff_uid: null };
      } else {
        const member = approvedMembers(teamId).find((r) => (r.staff_uid || r.user_id || '') === memberKey);
        if (!member) {
          setError('Select an approved member of this team.');
          return;
        }
        payload = { winner_name: member.staff_name || member.email || 'Participant', team_id: team.id, staff_uid: member.staff_uid || member.user_id || null };
      }
    } else {
      const member = approvedMembers('').find((r) => (r.staff_uid || r.user_id || '') === memberKey);
      if (!member) {
        setError('Select a registered participant.');
        return;
      }
      payload = { winner_name: member.staff_name || member.email || 'Participant', team_id: null, staff_uid: member.staff_uid || member.user_id || null };
    }

    setSaving(true);
    setError(null);
    try {
      await saveWinner({
        tournament_id: tournamentId,
        position: position.trim(),
        remarks: remarks || null,
        ...payload,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save winner.');
    } finally {
      setSaving(false);
    }
  };

  const members = approvedMembers(isTeamsMode ? teamId : '');

  return (
    <Modal open onClose={onClose} title="Add Result">
      <div className="form-grid">
        <div className="field">
          <label>Result / Award Category</label>
          <input
            list="winner-category-options"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g. Champion, Runner-up, Best Player, MVP…"
          />
          <datalist id="winner-category-options">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        {isTeamsMode && (
          <div className="field">
            <label>Awarded To</label>
            <select
              value={awardType}
              onChange={(e) => {
                setAwardType(e.target.value as 'Team' | 'Individual');
                setMemberKey('');
              }}
            >
              <option value="Team">Team</option>
              <option value="Individual">Individual (Member)</option>
            </select>
          </div>
        )}
        {isTeamsMode && (
          <div className="field">
            <label>Team</label>
            <select
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setMemberKey('');
              }}
            >
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.team_name}
                </option>
              ))}
            </select>
          </div>
        )}
        {(!isTeamsMode || awardType === 'Individual') && (
          <div className="field">
            <label>{isTeamsMode ? 'Member' : 'Participant'}</label>
            <select value={memberKey} onChange={(e) => setMemberKey(e.target.value)}>
              <option value="">Select {isTeamsMode ? 'member' : 'participant'}</option>
              {members.map((r) => (
                <option key={r.id} value={r.staff_uid || r.user_id || ''}>
                  {r.staff_name || r.email || 'Participant'}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field full">
          <label>Remarks</label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Result'}
        </button>
      </div>
    </Modal>
  );
}
