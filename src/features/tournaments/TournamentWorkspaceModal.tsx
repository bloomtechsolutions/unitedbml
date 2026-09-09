'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { TournamentTeamRow } from '../../types/database';
import { SetupModal } from './SetupModal';
import { TeamModal } from './TeamModal';
import { DISPLAY_PHASES, tournamentDisplayPhase } from './types';
import type { TournamentWithChildren } from './types';
import { UpdateFormModal } from './UpdateFormModal';
import { WinnerFormModal } from './WinnerFormModal';
import {
  createTeam,
  deleteWinner,
  fetchPublicStats,
  requestJoinTeam,
  resolveMyDepartment,
  selfRegisterIndividual,
} from './useTournaments';

type Tab = 'overview' | 'registration' | 'results';

interface Props {
  tournament: TournamentWithChildren | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function TournamentWorkspaceModal({ tournament, onClose, onRefresh }: Props) {
  const { profile, isCommitteeUser } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [setupOpen, setSetupOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [openTeam, setOpenTeam] = useState<TournamentTeamRow | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchPublicStats>> | null>(null);

  useEffect(() => {
    if (tournament && tab === 'results') {
      fetchPublicStats(tournament.id).then(setStats).catch(() => setStats(null));
    }
  }, [tournament, tab]);

  if (!tournament) return null;

  const isTeamsMode = tournament.tournament_mode === 'Teams';
  const myRegistration = tournament.registrations.find((r) => r.user_id === profile?.id);
  const phase = tournamentDisplayPhase(tournament.status, tournament.eventDate, tournament.winners.length > 0, tournament.eventCancelled);

  const handleSelfRegister = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const department = await resolveMyDepartment(profile.id);
      await selfRegisterIndividual(
        tournament.id,
        { id: profile.id, full_name: profile.full_name, email: profile.email, member_uid: profile.member_uid, contact_no: profile.contact_no },
        department
      );
      await onRefresh();
      toast('Registered');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to register.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!profile || !newTeamName.trim()) return;
    setBusy(true);
    try {
      const department = await resolveMyDepartment(profile.id);
      await createTeam(
        tournament.id,
        newTeamName.trim(),
        { id: profile.id, full_name: profile.full_name, email: profile.email, member_uid: profile.member_uid, contact_no: profile.contact_no },
        department
      );
      setNewTeamName('');
      await onRefresh();
      toast('Team created');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create team.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      const department = await resolveMyDepartment(profile.id);
      await requestJoinTeam(
        tournament.id,
        teamId,
        { id: profile.id, full_name: profile.full_name, email: profile.email, member_uid: profile.member_uid, contact_no: profile.contact_no },
        department
      );
      await onRefresh();
      toast('Join request sent to team leader');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to request join.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveWinner = async (id: string) => {
    if (!confirm('Remove this result?')) return;
    try {
      await deleteWinner(id);
      await onRefresh();
      toast('Result removed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove result.');
    }
  };

  const pinnedUpdates = tournament.updates.filter((u) => u.is_pinned);
  const existingCategories = Array.from(new Set(tournament.winners.map((w) => w.position).filter(Boolean)));

  return (
    <Modal open onClose={onClose} title={tournament.name} wide>
      <div className="tabs">
        {(['overview', 'registration', 'results'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Overview' : t === 'registration' ? 'Registration & Teams' : 'Results & Stats'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="tour-stage-line" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {phase === 'Cancelled' ? (
              <span className="pill cancel">Cancelled</span>
            ) : (
              DISPLAY_PHASES.map((s) => (
                <span key={s} className={`pill ${s === phase ? 'open' : 'plan'}`}>
                  {s}
                </span>
              ))
            )}
          </div>
          <div className="kpis">
            <div className="kpi">
              <div className="lbl">Registered</div>
              <strong>{tournament.registrations.filter((r) => r.status === 'Approved').length}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Teams</div>
              <strong>{tournament.teams.length}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Results Recorded</div>
              <strong>{tournament.winners.length}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Event Date</div>
              <strong style={{ fontSize: 16 }}>{tournament.eventDate || '—'}</strong>
            </div>
          </div>
          <p>
            <b>Venue:</b> {tournament.venue || '—'} &nbsp; <b>Sport:</b> {tournament.sport || '—'}
          </p>
          <p style={{ fontSize: 13 }}>{tournament.rules}</p>
          {pinnedUpdates.map((u) => (
            <div key={u.id} className="event-alert warning">
              <b>{u.title}</b> — {u.message}
            </div>
          ))}
          {isCommitteeUser && (
            <div className="modal-actions">
              <Link href={`/events?open=${tournament.event_id}`} className="btn ghost">
                Attendance →
              </Link>
              <button className="btn ghost" onClick={() => setSetupOpen(true)}>
                Registration Settings
              </button>
              <button className="btn primary" onClick={() => setUpdateOpen(true)}>
                Post Update
              </button>
            </div>
          )}
          <h4 style={{ marginTop: 16 }}>Updates</h4>
          {tournament.updates.slice(0, 5).map((u) => (
            <div key={u.id} className="reimb-card">
              <b>{u.title}</b> {u.is_pinned && <span className="pill plan">Pinned</span>}
              <p style={{ fontSize: 12 }}>{u.message}</p>
            </div>
          ))}
          {!tournament.updates.length && <p style={{ color: 'var(--muted)' }}>No updates posted yet.</p>}
        </div>
      )}

      {tab === 'registration' && (
        <div>
          {tournament.status !== 'Registration Open' && (
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>Registration is not currently open ({tournament.status}).</p>
          )}
          {!isTeamsMode ? (
            <div>
              {!myRegistration && tournament.status === 'Registration Open' && (
                <button className="btn primary" disabled={busy} onClick={() => void handleSelfRegister()}>
                  Self Register
                </button>
              )}
              {myRegistration && <p>You are registered ({myRegistration.status}).</p>}
              <table className="table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tournament.registrations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.staff_name}</td>
                      <td>{r.department || '—'}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              {!myRegistration && tournament.status === 'Registration Open' && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input placeholder="New team name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                  <button className="btn primary" disabled={busy} onClick={() => void handleCreateTeam()}>
                    Create Team
                  </button>
                </div>
              )}
              <div className="event-grid">
                {tournament.teams.map((team) => {
                  const members = tournament.registrations.filter((r) => r.team_id === team.id && r.status === 'Approved');
                  const isMember = tournament.registrations.some((r) => r.team_id === team.id && r.user_id === profile?.id);
                  const ready = !tournament.team_size || members.length >= tournament.team_size;
                  return (
                    <div key={team.id} className="event-card" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ margin: '0 0 6px' }}>{team.team_name}</h3>
                        <span className={`pill ${ready ? 'done' : 'plan'}`}>{ready ? 'Ready' : 'Filling'}</span>
                      </div>
                      <small style={{ color: 'var(--muted)' }}>
                        {members.length}
                        {tournament.team_size ? `/${tournament.team_size}` : ''} members
                      </small>
                      <p style={{ fontSize: 12, margin: '8px 0' }}>Leader: {team.leader_name}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn ghost" onClick={() => setOpenTeam(team)}>
                          Open Team
                        </button>
                        {!myRegistration && !isMember && tournament.status === 'Registration Open' && (
                          <button className="btn soft" disabled={busy} onClick={() => void handleJoinTeam(team.id)}>
                            Request to Join
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!tournament.teams.length && <p style={{ color: 'var(--muted)' }}>No teams created yet.</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div>
          <div className="kpis">
            <div className="kpi">
              <div className="lbl">Registered</div>
              <strong>{stats?.registrations ?? tournament.registrations.filter((r) => r.status === 'Approved').length}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Teams</div>
              <strong>{stats?.teams ?? tournament.teams.length}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Results Recorded</div>
              <strong>{tournament.winners.length}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Pending Approvals</div>
              <strong>{stats?.pending ?? tournament.registrations.filter((r) => r.status === 'Pending Leader Approval').length}</strong>
            </div>
          </div>

          {!!tournament.winners.length && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
              {tournament.winners.slice(0, 3).map((w) => (
                <div key={w.id} className="event-card" style={{ padding: '14px 18px', flex: '1 1 160px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{w.position}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{w.winner_name}</div>
                </div>
              ))}
            </div>
          )}

          {isCommitteeUser && (
            <button className="btn primary" onClick={() => setWinnerModalOpen(true)}>
              + Add Result
            </button>
          )}
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Result / Award Category</th>
                <th>Winner</th>
                <th>Remarks</th>
                {isCommitteeUser && <th />}
              </tr>
            </thead>
            <tbody>
              {tournament.winners.map((w) => (
                <tr key={w.id}>
                  <td>{w.position}</td>
                  <td>{w.winner_name}</td>
                  <td>{w.remarks || '—'}</td>
                  {isCommitteeUser && (
                    <td>
                      <button className="btn danger" onClick={() => void handleRemoveWinner(w.id)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!tournament.winners.length && (
                <tr>
                  <td colSpan={isCommitteeUser ? 4 : 3} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No results recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {stats?.departments && stats.departments.length > 0 && (
            <>
              <h4 style={{ marginTop: 16 }}>Department Engagement</h4>
              {stats.departments.map((d) => (
                <div key={d.department} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{d.department}</span>
                    <span>{d.count}</span>
                  </div>
                  <div className="committee-term-overview-track">
                    <span style={{ width: `${Math.min(100, (d.count / (stats.registrations || 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <SetupModal tournament={setupOpen ? tournament : null} onClose={() => setSetupOpen(false)} onSaved={onRefresh} />
      <UpdateFormModal open={updateOpen} onClose={() => setUpdateOpen(false)} tournamentId={tournament.id} onSaved={onRefresh} />
      <WinnerFormModal
        open={winnerModalOpen}
        onClose={() => setWinnerModalOpen(false)}
        tournamentId={tournament.id}
        isTeamsMode={isTeamsMode}
        teams={tournament.teams}
        registrations={tournament.registrations}
        existingCategories={existingCategories}
        onSaved={onRefresh}
      />
      <TeamModal
        team={openTeam}
        registrations={tournament.registrations.filter((r) => r.team_id === openTeam?.id)}
        tournamentId={tournament.id}
        isCommittee={isCommitteeUser}
        onClose={() => setOpenTeam(null)}
        onRefresh={onRefresh}
      />
    </Modal>
  );
}
