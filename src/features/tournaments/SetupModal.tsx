'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { TournamentRow } from '../../types/database';
import { TOURNAMENT_STATUSES } from './types';
import { saveTournamentSetup } from './useTournaments';

interface Values {
  tournament_mode: string;
  sport: string;
  rules: string;
  status: string;
  venue: string;
  registration_open: string;
  registration_close: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  max_teams: number;
  team_size: number;
}

interface Props {
  tournament: TournamentRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function SetupModal({ tournament, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Values | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament) return;
    setValues({
      tournament_mode: tournament.tournament_mode,
      sport: tournament.sport ?? '',
      rules: tournament.rules ?? '',
      status: tournament.status,
      venue: tournament.venue ?? '',
      registration_open: tournament.registration_open ?? '',
      registration_close: tournament.registration_close ?? '',
      start_date: tournament.start_date ?? '',
      end_date: tournament.end_date ?? '',
      max_participants: tournament.max_participants ?? 0,
      max_teams: tournament.max_teams ?? 0,
      team_size: tournament.team_size ?? 0,
    });
    setError(null);
  }, [tournament]);

  if (!tournament || !values) return null;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveTournamentSetup(tournament.id, {
        tournament_mode: values.tournament_mode,
        sport: values.sport || null,
        rules: values.rules || null,
        status: values.status,
        venue: values.venue || null,
        registration_open: values.registration_open || null,
        registration_close: values.registration_close || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        max_participants: values.max_participants || null,
        max_teams: values.max_teams || null,
        team_size: values.team_size || null,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tournament setup.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Tournament Setup — ${tournament.name}`} wide>
      <div className="form-grid">
        <div className="field">
          <label>Mode</label>
          <select value={values.tournament_mode} onChange={(e) => setValues((v) => v && { ...v, tournament_mode: e.target.value })}>
            <option value="Individual">Individual</option>
            <option value="Teams">Teams</option>
          </select>
        </div>
        <div className="field">
          <label>Sport</label>
          <input value={values.sport} onChange={(e) => setValues((v) => v && { ...v, sport: e.target.value })} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={values.status} onChange={(e) => setValues((v) => v && { ...v, status: e.target.value })}>
            {TOURNAMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Venue</label>
          <input value={values.venue} onChange={(e) => setValues((v) => v && { ...v, venue: e.target.value })} />
        </div>
        <div className="field">
          <label>Registration Opens</label>
          <input type="date" value={values.registration_open} onChange={(e) => setValues((v) => v && { ...v, registration_open: e.target.value })} />
        </div>
        <div className="field">
          <label>Registration Closes</label>
          <input type="date" value={values.registration_close} onChange={(e) => setValues((v) => v && { ...v, registration_close: e.target.value })} />
        </div>
        <div className="field">
          <label>Start Date</label>
          <input type="date" value={values.start_date} onChange={(e) => setValues((v) => v && { ...v, start_date: e.target.value })} />
        </div>
        <div className="field">
          <label>End Date</label>
          <input type="date" value={values.end_date} onChange={(e) => setValues((v) => v && { ...v, end_date: e.target.value })} />
        </div>
        <div className="field">
          <label>Max Participants</label>
          <input type="number" min={0} value={values.max_participants} onChange={(e) => setValues((v) => v && { ...v, max_participants: Number(e.target.value) })} />
        </div>
        {values.tournament_mode === 'Teams' && (
          <>
            <div className="field">
              <label>Max Teams</label>
              <input type="number" min={0} value={values.max_teams} onChange={(e) => setValues((v) => v && { ...v, max_teams: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Team Size</label>
              <input type="number" min={0} value={values.team_size} onChange={(e) => setValues((v) => v && { ...v, team_size: Number(e.target.value) })} />
            </div>
          </>
        )}
        <div className="field full">
          <label>Rules</label>
          <textarea value={values.rules} onChange={(e) => setValues((v) => v && { ...v, rules: e.target.value })} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Setup'}
        </button>
      </div>
    </Modal>
  );
}
