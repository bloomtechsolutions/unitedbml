'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import type { TournamentTeamRow } from '../../types/database';
import { saveWinner } from './useTournaments';

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  isTeamsMode: boolean;
  teams: TournamentTeamRow[];
  onSaved: () => Promise<void>;
}

export function WinnerFormModal({ open, onClose, tournamentId, isTeamsMode, teams, onSaved }: Props) {
  const [position, setPosition] = useState('1st');
  const [winnerName, setWinnerName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    const team = teams.find((t) => t.id === teamId);
    const name = isTeamsMode ? team?.team_name ?? winnerName : winnerName;
    if (!name.trim()) {
      setError('Winner is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveWinner({
        tournament_id: tournamentId,
        position,
        winner_name: name.trim(),
        team_id: isTeamsMode ? teamId || null : null,
        remarks: remarks || null,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save winner.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add Winner">
      <div className="form-grid">
        <div className="field">
          <label>Position</label>
          <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="1st, 2nd, 3rd…" />
        </div>
        <div className="field">
          <label>Winner</label>
          {isTeamsMode ? (
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.team_name}
                </option>
              ))}
            </select>
          ) : (
            <input value={winnerName} onChange={(e) => setWinnerName(e.target.value)} />
          )}
        </div>
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
          {saving ? 'Saving…' : 'Save Winner'}
        </button>
      </div>
    </Modal>
  );
}
