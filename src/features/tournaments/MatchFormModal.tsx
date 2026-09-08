'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { TournamentMatchRow, TournamentTeamRow } from '../../types/database';
import { MATCH_STATUSES } from './types';
import { saveMatch } from './useTournaments';

interface Values {
  match_no: number;
  stage: string;
  match_date: string;
  match_time: string;
  venue: string;
  side_a: string;
  side_b: string;
  score_a: number;
  score_b: number;
  status: string;
  remarks: string;
}

const EMPTY: Values = {
  match_no: 1,
  stage: '',
  match_date: '',
  match_time: '',
  venue: '',
  side_a: '',
  side_b: '',
  score_a: 0,
  score_b: 0,
  status: 'Scheduled',
  remarks: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  isTeamsMode: boolean;
  teams: TournamentTeamRow[];
  editing: TournamentMatchRow | null;
  onSaved: () => Promise<void>;
}

export function MatchFormModal({ open, onClose, tournamentId, isTeamsMode, teams, editing, onSaved }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        match_no: editing.match_no ?? 1,
        stage: editing.stage ?? '',
        match_date: editing.match_date ?? '',
        match_time: editing.match_time ?? '',
        venue: editing.venue ?? '',
        side_a: (isTeamsMode ? editing.team_a : editing.participant_a) ?? '',
        side_b: (isTeamsMode ? editing.team_b : editing.participant_b) ?? '',
        score_a: editing.score_a ?? 0,
        score_b: editing.score_b ?? 0,
        status: editing.status,
        remarks: editing.remarks ?? '',
      });
    } else {
      setValues(EMPTY);
    }
    setError(null);
  }, [open, editing, isTeamsMode]);

  const handleSubmit = async () => {
    if (!values.side_a.trim() || !values.side_b.trim()) {
      setError('Both sides are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveMatch({
        id: editing?.id,
        tournament_id: tournamentId,
        match_no: values.match_no,
        stage: values.stage || null,
        match_date: values.match_date || null,
        match_time: values.match_time || null,
        venue: values.venue || null,
        team_a: isTeamsMode ? values.side_a : null,
        team_b: isTeamsMode ? values.side_b : null,
        participant_a: isTeamsMode ? null : values.side_a,
        participant_b: isTeamsMode ? null : values.side_b,
        score_a: values.score_a,
        score_b: values.score_b,
        status: values.status,
        remarks: values.remarks || null,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save match.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Match' : 'Add Match'}>
      <div className="form-grid">
        <div className="field">
          <label>Match No.</label>
          <input type="number" value={values.match_no} onChange={(e) => setValues((v) => ({ ...v, match_no: Number(e.target.value) }))} />
        </div>
        <div className="field">
          <label>Stage</label>
          <input value={values.stage} onChange={(e) => setValues((v) => ({ ...v, stage: e.target.value }))} placeholder="e.g. Group Stage, Final" />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={values.match_date} onChange={(e) => setValues((v) => ({ ...v, match_date: e.target.value }))} />
        </div>
        <div className="field">
          <label>Time</label>
          <input type="time" value={values.match_time} onChange={(e) => setValues((v) => ({ ...v, match_time: e.target.value }))} />
        </div>
        <div className="field">
          <label>Venue</label>
          <input value={values.venue} onChange={(e) => setValues((v) => ({ ...v, venue: e.target.value }))} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}>
            {MATCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{isTeamsMode ? 'Team A' : 'Participant A'}</label>
          {isTeamsMode ? (
            <select value={values.side_a} onChange={(e) => setValues((v) => ({ ...v, side_a: e.target.value }))}>
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.team_name}>
                  {t.team_name}
                </option>
              ))}
            </select>
          ) : (
            <input value={values.side_a} onChange={(e) => setValues((v) => ({ ...v, side_a: e.target.value }))} />
          )}
        </div>
        <div className="field">
          <label>Score A</label>
          <input type="number" value={values.score_a} onChange={(e) => setValues((v) => ({ ...v, score_a: Number(e.target.value) }))} />
        </div>
        <div className="field">
          <label>{isTeamsMode ? 'Team B' : 'Participant B'}</label>
          {isTeamsMode ? (
            <select value={values.side_b} onChange={(e) => setValues((v) => ({ ...v, side_b: e.target.value }))}>
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.team_name}>
                  {t.team_name}
                </option>
              ))}
            </select>
          ) : (
            <input value={values.side_b} onChange={(e) => setValues((v) => ({ ...v, side_b: e.target.value }))} />
          )}
        </div>
        <div className="field">
          <label>Score B</label>
          <input type="number" value={values.score_b} onChange={(e) => setValues((v) => ({ ...v, score_b: Number(e.target.value) }))} />
        </div>
        <div className="field full">
          <label>Remarks</label>
          <textarea value={values.remarks} onChange={(e) => setValues((v) => ({ ...v, remarks: e.target.value }))} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Match'}
        </button>
      </div>
    </Modal>
  );
}
