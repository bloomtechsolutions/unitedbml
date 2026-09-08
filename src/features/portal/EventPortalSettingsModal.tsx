'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { supabase } from '../../lib/supabase';
import type { PortalEvent } from './types';
import { assignExternalOfficial, saveEventWinner, updateEventRegistrationSettings } from './usePortal';

interface Props {
  event: PortalEvent | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function EventPortalSettingsModal({ event, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const toast = useToast();

  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [registrationMode, setRegistrationMode] = useState('None');
  const [participantCapacity, setParticipantCapacity] = useState<number | ''>('');
  const [teamSize, setTeamSize] = useState<number | ''>('');
  const [participantRules, setParticipantRules] = useState('');
  const [saving, setSaving] = useState(false);

  const [officialEmail, setOfficialEmail] = useState('');
  const [officialRole, setOfficialRole] = useState('Team Manager');
  const [assigning, setAssigning] = useState(false);

  const [winnerPosition, setWinnerPosition] = useState('1st Place');
  const [winnerName, setWinnerName] = useState('');
  const [winnerRemarks, setWinnerRemarks] = useState('');
  const [savingWinner, setSavingWinner] = useState(false);

  useEffect(() => {
    if (!event) return;
    setRegistrationEnabled(event.registration_enabled);
    setRegistrationMode(event.registration_mode);
    setParticipantCapacity(event.participant_capacity ?? '');
    setTeamSize(event.team_size ?? '');
    setParticipantRules(event.participant_rules ?? '');
  }, [event]);

  if (!event) return null;

  const saveSettings = async () => {
    setSaving(true);
    try {
      await updateEventRegistrationSettings(event.id, {
        registration_enabled: registrationEnabled,
        registration_mode: registrationMode,
        participant_capacity: participantCapacity === '' ? null : Number(participantCapacity),
        team_size: teamSize === '' ? null : Number(teamSize),
        participant_rules: participantRules || null,
      });
      toast('Registration settings saved');
      await onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const assignOfficial = async () => {
    if (!officialEmail.trim() || !profile) return;
    setAssigning(true);
    try {
      const { data: match, error } = await supabase.from('profiles').select('id').eq('email', officialEmail.trim().toLowerCase()).maybeSingle();
      if (error || !match) throw new Error('No account found with that email.');
      await assignExternalOfficial(event.id, match.id, officialRole, profile.id);
      setOfficialEmail('');
      toast('External official assigned');
      await onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to assign official.');
    } finally {
      setAssigning(false);
    }
  };

  const addWinner = async () => {
    if (!winnerName.trim()) return;
    setSavingWinner(true);
    try {
      await saveEventWinner({ event_id: event.id, position: winnerPosition, winner_name: winnerName.trim(), remarks: winnerRemarks || null });
      setWinnerName('');
      setWinnerRemarks('');
      toast('Winner recorded');
      await onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to record winner.');
    } finally {
      setSavingWinner(false);
    }
  };

  return (
    <Modal open={Boolean(event)} onClose={onClose} title={`Configure — ${event.name}`} wide>
      <h4>Registration Settings</h4>
      <div className="form-grid">
        <div className="field">
          <label>Registration Enabled</label>
          <select value={registrationEnabled ? '1' : '0'} onChange={(e) => setRegistrationEnabled(e.target.value === '1')}>
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </div>
        <div className="field">
          <label>Mode</label>
          <select value={registrationMode} onChange={(e) => setRegistrationMode(e.target.value)}>
            <option value="None">None</option>
            <option value="Individual">Individual</option>
            <option value="Teams">Teams</option>
          </select>
        </div>
        <div className="field">
          <label>Capacity</label>
          <input type="number" min={0} value={participantCapacity} onChange={(e) => setParticipantCapacity(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Team Size</label>
          <input type="number" min={0} value={teamSize} onChange={(e) => setTeamSize(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        <div className="field full">
          <label>Participant Rules</label>
          <textarea value={participantRules} onChange={(e) => setParticipantRules(e.target.value)} />
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn primary" onClick={() => void saveSettings()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Registration Settings'}
        </button>
      </div>

      <h4 style={{ marginTop: 20 }}>Assign External Event Official</h4>
      <div className="form-grid">
        <div className="field">
          <label>Email (existing account)</label>
          <input value={officialEmail} onChange={(e) => setOfficialEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div className="field">
          <label>Role</label>
          <input value={officialRole} onChange={(e) => setOfficialRole(e.target.value)} placeholder="Team Manager" />
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => void assignOfficial()} disabled={assigning}>
          {assigning ? 'Assigning…' : 'Assign Official'}
        </button>
      </div>
      {event.registrations.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          {event.registrations.filter((r) => r.status === 'Approved').length} approved registration(s) so far.
        </div>
      )}

      <h4 style={{ marginTop: 20 }}>Record a Winner</h4>
      <div className="form-grid">
        <div className="field">
          <label>Position</label>
          <input value={winnerPosition} onChange={(e) => setWinnerPosition(e.target.value)} />
        </div>
        <div className="field">
          <label>Winner Name</label>
          <input value={winnerName} onChange={(e) => setWinnerName(e.target.value)} />
        </div>
        <div className="field full">
          <label>Remarks</label>
          <input value={winnerRemarks} onChange={(e) => setWinnerRemarks(e.target.value)} />
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => void addWinner()} disabled={savingWinner}>
          {savingWinner ? 'Saving…' : 'Add Winner'}
        </button>
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
