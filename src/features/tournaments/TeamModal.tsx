'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { TournamentRegistrationRow, TournamentTeamRow } from '../../types/database';
import { decideJoinRequest, removeTeamMember, sendTeamMessage, useTeamMessages } from './useTournaments';

interface Props {
  team: TournamentTeamRow | null;
  registrations: TournamentRegistrationRow[];
  tournamentId: string;
  isCommittee: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function TeamModal({ team, registrations, tournamentId, isCommittee, onClose, onRefresh }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const { messages, reload: reloadMessages } = useTeamMessages(team?.id ?? null);
  const [chatText, setChatText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!team) return null;

  const isLeader = team.leader_user_id === profile?.id;
  const canManage = isCommittee || isLeader;
  const approved = registrations.filter((r) => r.status === 'Approved');
  const pending = registrations.filter((r) => r.status === 'Pending Leader Approval');

  const handleDecide = async (registrationId: string, decision: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await decideJoinRequest(registrationId, decision);
      await onRefresh();
      toast(decision === 'approve' ? 'Request approved' : 'Request rejected');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to decide request.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (registrationId: string) => {
    const reason = prompt('Reason for removing this member (optional):') ?? '';
    setBusy(true);
    try {
      await removeTeamMember(registrationId, reason);
      await onRefresh();
      toast('Member removed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove member.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatText.trim()) return;
    try {
      await sendTeamMessage({
        tournament_id: tournamentId,
        team_id: team.id,
        user_id: profile?.id ?? '',
        sender_name: profile?.full_name || profile?.email || 'Unknown',
        message: chatText.trim(),
      });
      setChatText('');
      await reloadMessages();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send message.');
    }
  };

  return (
    <Modal open onClose={onClose} title={team.team_name} wide>
      <div className="committee-info-grid">
        <div className="committee-info">
          <small>Leader</small>
          <b>{team.leader_name}</b>
        </div>
        <div className="committee-info">
          <small>Join Code</small>
          <b>{team.join_code}</b>
        </div>
        <div className="committee-info">
          <small>Status</small>
          <b>{team.status}</b>
        </div>
        <div className="committee-info">
          <small>Members</small>
          <b>{approved.length}</b>
        </div>
      </div>

      <h4 style={{ marginTop: 16 }}>Roster</h4>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Department</th>
            {canManage && <th />}
          </tr>
        </thead>
        <tbody>
          {approved.map((r) => (
            <tr key={r.id}>
              <td>
                {r.staff_name} {r.user_id === team.leader_user_id && <span className="pill plan">Leader</span>}
              </td>
              <td>{r.contact_no || '—'}</td>
              <td>{r.department || '—'}</td>
              {canManage && (
                <td>
                  {r.user_id !== team.leader_user_id && (
                    <button className="btn danger" disabled={busy} onClick={() => void handleRemove(r.id)}>
                      Remove
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {canManage && pending.length > 0 && (
        <>
          <h4 style={{ marginTop: 16 }}>Join Requests</h4>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td>{r.staff_name}</td>
                  <td>{r.department || '—'}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn danger" disabled={busy} onClick={() => void handleDecide(r.id, 'reject')}>
                      Reject
                    </button>
                    <button className="btn primary" disabled={busy} onClick={() => void handleDecide(r.id, 'approve')}>
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h4 style={{ marginTop: 16 }}>Team Chat</h4>
      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: 10, marginBottom: 8 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 8, fontSize: 12 }}>
            <b>{m.sender_name}:</b> {m.message}
          </div>
        ))}
        {!messages.length && <small style={{ color: 'var(--muted)' }}>No messages yet.</small>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Message the team…" style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => void handleSendMessage()}>
          Send
        </button>
      </div>

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
