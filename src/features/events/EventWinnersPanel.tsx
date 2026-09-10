'use client';

import { useState } from 'react';
import { useToast } from '../../lib/ToastContext';
import { deleteWinner, ensureTournamentForEvent, saveWinner, useEventWinners } from '../tournaments/useTournaments';

const CATEGORY_OPTIONS = ['Champion', 'Runner-up', '1st', '2nd', '3rd', 'Best Player', 'MVP', 'Fair Play'];

interface Props {
  eventId: string;
  eventName: string;
  canManage: boolean;
}

export function EventWinnersPanel({ eventId, eventName, canManage }: Props) {
  const { winners, loading, reload } = useEventWinners(eventId);
  const toast = useToast();
  const [position, setPosition] = useState('');
  const [winnerName, setWinnerName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!position.trim() || !winnerName.trim()) {
      toast('Result / Award category and winner name are required.');
      return;
    }
    setSaving(true);
    try {
      const tournamentId = await ensureTournamentForEvent(eventId, eventName);
      await saveWinner({
        tournament_id: tournamentId,
        position: position.trim(),
        winner_name: winnerName.trim(),
        remarks: remarks || null,
      });
      setPosition('');
      setWinnerName('');
      setRemarks('');
      await reload();
      toast('Result saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save result.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this result?')) return;
    await deleteWinner(id);
    await reload();
    toast('Result removed');
  };

  return (
    <div>
      <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginBottom: 16 }}>
        Record the results/winners of this event. Recorded results feed the Leaderboard automatically.
      </p>

      <table className="ub-table">
        <thead>
          <tr>
            <th>Result / Award</th>
            <th>Winner</th>
            <th>Remarks</th>
            {canManage && <th />}
          </tr>
        </thead>
        <tbody>
          {winners.map((w) => (
            <tr key={w.id}>
              <td>{w.position}</td>
              <td>{w.winner_name}</td>
              <td>{w.remarks || '—'}</td>
              {canManage && (
                <td>
                  <button className="ub-btn ub-btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => void handleDelete(w.id)}>
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!loading && !winners.length && (
            <tr>
              <td colSpan={canManage ? 4 : 3} className="ub-empty">
                No results recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canManage && (
        <div className="ub-card" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add Result</h3>
          <div className="form-grid">
            <div className="field">
              <label>Result / Award Category</label>
              <input
                list="event-winner-category-options"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Champion, Runner-up, MVP…"
              />
              <datalist id="event-winner-category-options">
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>Winner Name</label>
              <input value={winnerName} onChange={(e) => setWinnerName(e.target.value)} placeholder="Staff name or team name" />
            </div>
            <div className="field full">
              <label>Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <div className="modal-actions" style={{ marginTop: 4 }}>
            <button className="ub-btn ub-btn-primary" disabled={saving} onClick={() => void handleAdd()}>
              {saving ? 'Saving…' : 'Save Result'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
