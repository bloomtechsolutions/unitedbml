'use client';

import { useState } from 'react';
import { TournamentWorkspaceModal } from './TournamentWorkspaceModal';
import { useTournaments } from './useTournaments';

export function TournamentsPage() {
  const { tournaments, loading, error, reload } = useTournaments();
  const [openId, setOpenId] = useState<string | null>(null);

  const open = openId ? tournaments.find((t) => t.id === openId) ?? null : null;

  if (loading) return <div>Loading tournaments…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load tournaments: {error}</div>;

  return (
    <div>
      <div className="tournament-hero">
        <div>
          <h2>Tournaments</h2>
          <p>
            Tournaments are created automatically once a sports-flagged Event with an approved expense is
            confirmed — this page manages the tournaments that already exist.
          </p>
        </div>
      </div>

      <div className="event-grid">
        {tournaments.map((t) => {
          const registered = t.registrations.filter((r) => r.status === 'Approved').length;
          return (
            <div key={t.id} className="event-card" onClick={() => setOpenId(t.id)} style={{ padding: 16 }}>
              <span className={`pill ${t.status === 'Registration Open' ? 'open' : t.status === 'Completed' ? 'done' : 'plan'}`}>
                {t.status}
              </span>
              <h3 style={{ margin: '10px 0 4px' }}>{t.name}</h3>
              <small style={{ color: 'var(--muted)' }}>
                {t.eventName} · {t.tournament_mode}
              </small>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0' }}>
                {registered} registered · {t.teams.length} teams · {t.matches.length} matches
              </p>
            </div>
          );
        })}
        {!tournaments.length && (
          <div style={{ color: 'var(--muted)' }}>
            No tournaments yet. They appear automatically once a sports Event's expense is approved.
          </div>
        )}
      </div>

      <TournamentWorkspaceModal tournament={open} onClose={() => setOpenId(null)} onRefresh={reload} />
    </div>
  );
}
