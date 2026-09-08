'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import type { PortalEvent } from './types';
import { decideEventTeamJoin, sendEventTeamMessage, useEventTeamMessages } from './usePortal';

interface Props {
  event: PortalEvent | null;
  teamId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function TeamDetailModal({ event, teamId, onClose, onChanged }: Props) {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const team = event?.teams.find((t) => t.id === teamId) ?? null;
  const { messages, reload: reloadMessages } = useEventTeamMessages(teamId);

  if (!event || !team) return null;

  const members = event.registrations.filter((r) => r.team_id === team.id);
  const isLeader = team.leader_user_id === profile?.id;
  const isMember = members.some((m) => m.user_id === profile?.id && m.status === 'Approved');
  const pending = members.filter((m) => m.status === 'Pending Leader Approval');

  const decide = async (registrationId: string, approve: boolean) => {
    setBusy(true);
    try {
      await decideEventTeamJoin(registrationId, approve);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!message.trim() || !profile) return;
    setBusy(true);
    try {
      await sendEventTeamMessage({
        event_id: event.id,
        team_id: team.id,
        user_id: profile.id,
        sender_name: profile.full_name,
        message: message.trim(),
      });
      setMessage('');
      await reloadMessages();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={Boolean(team)} onClose={onClose} title={team.team_name}>
      <div className="portal-team-members">
        <h4>Roster</h4>
        {members
          .filter((m) => m.status === 'Approved')
          .map((m) => (
            <div key={m.id} className="portal-team-member">
              <span>
                {m.staff_name} {m.user_id === team.leader_user_id ? '(Leader)' : ''}
              </span>
              <span>{m.department || '—'}</span>
            </div>
          ))}
      </div>

      {isLeader && pending.length > 0 && (
        <div className="portal-team-members">
          <h4>Pending Join Requests</h4>
          {pending.map((m) => (
            <div key={m.id} className="portal-team-member">
              <span>{m.staff_name}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn ghost" disabled={busy} onClick={() => void decide(m.id, false)}>
                  Reject
                </button>
                <button className="btn primary" disabled={busy} onClick={() => void decide(m.id, true)}>
                  Approve
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {(isLeader || isMember) && (
        <div style={{ marginTop: 14 }}>
          <h4>Team Discussion</h4>
          <div className="portal-chat">
            {messages.map((m) => (
              <div key={m.id} className="portal-chat-msg">
                <b>{m.sender_name}</b>
                <small>{new Date(m.created_at).toLocaleString()}</small>
                <p>{m.message}</p>
              </div>
            ))}
            {!messages.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No messages yet.</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              style={{ flex: 1 }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message your team…"
            />
            <button className="btn primary" disabled={busy} onClick={() => void send()}>
              Send
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
