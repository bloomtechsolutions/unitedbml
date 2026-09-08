'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { TournamentMatchRow, TournamentTeamRow } from '../../types/database';
import { MatchFormModal } from './MatchFormModal';
import { SetupModal } from './SetupModal';
import { TeamModal } from './TeamModal';
import { LIFECYCLE_STAGES, lifecycleStage } from './types';
import type { TournamentWithChildren } from './types';
import { UpdateFormModal } from './UpdateFormModal';
import { WinnerFormModal } from './WinnerFormModal';
import {
  createTeam,
  deleteMatch,
  fetchPublicStats,
  requestJoinTeam,
  resolveMyDepartment,
  selfRegisterIndividual,
} from './useTournaments';

type Tab = 'overview' | 'registration' | 'matches' | 'live' | 'results';

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
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<TournamentMatchRow | null>(null);
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
  const stage = lifecycleStage(tournament.status);

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

  const handleDeleteMatch = async (match: TournamentMatchRow) => {
    if (!confirm('Remove this match?')) return;
    await deleteMatch(match.id);
    await onRefresh();
    toast('Match removed');
  };

  const upcomingMatches = tournament.matches.filter((m) => m.status === 'Scheduled' || m.status === 'Live').slice(0, 5);
  const liveMatches = tournament.matches.filter((m) => m.status === 'Live' || m.status === 'Completed').slice(0, 8);
  const pinnedUpdates = tournament.updates.filter((u) => u.is_pinned);

  return (
    <Modal open onClose={onClose} title={tournament.name} wide>
      <div className="tabs">
        {(['overview', 'registration', 'matches', 'live', 'results'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview'
              ? 'Overview'
              : t === 'registration'
                ? 'Registration & Teams'
                : t === 'matches'
                  ? 'Match Schedule'
                  : t === 'live'
                    ? 'Live Screen'
                    : 'Results & Stats'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="tour-stage-line" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {LIFECYCLE_STAGES.map((s) => (
              <span key={s} className={`pill ${s === stage ? 'open' : 'plan'}`}>
                {s}
              </span>
            ))}
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
              <div className="lbl">Matches</div>
              <strong>{tournament.matches.length}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Completed</div>
              <strong>{tournament.matches.filter((m) => m.status === 'Completed').length}</strong>
            </div>
          </div>
          <p>
            <b>Venue:</b> {tournament.venue || '—'} &nbsp; <b>Sport:</b> {tournament.sport || '—'}
          </p>
          <p style={{ fontSize: 13 }}>{tournament.rules}</p>
          {isCommitteeUser && (
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setSetupOpen(true)}>
                Setup
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
          <h4 style={{ marginTop: 16 }}>Next Matches</h4>
          {upcomingMatches.map((m) => (
            <div key={m.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              {m.match_date} {m.match_time} — {(isTeamsMode ? m.team_a : m.participant_a) || '—'} vs{' '}
              {(isTeamsMode ? m.team_b : m.participant_b) || '—'}
            </div>
          ))}
          {!upcomingMatches.length && <p style={{ color: 'var(--muted)' }}>No upcoming matches scheduled.</p>}
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
                  return (
                    <div key={team.id} className="event-card" style={{ padding: 16 }}>
                      <h3 style={{ margin: '0 0 6px' }}>{team.team_name}</h3>
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

      {tab === 'matches' && (
        <div>
          {isCommitteeUser && (
            <div className="toolbar">
              <div />
              <button
                className="btn primary"
                onClick={() => {
                  setEditingMatch(null);
                  setMatchModalOpen(true);
                }}
              >
                + Add Match
              </button>
            </div>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Stage</th>
                <th>Date</th>
                <th>Match</th>
                <th>Score</th>
                <th>Status</th>
                {isCommitteeUser && <th />}
              </tr>
            </thead>
            <tbody>
              {tournament.matches.map((m) => (
                <tr key={m.id}>
                  <td>{m.match_no}</td>
                  <td>{m.stage}</td>
                  <td>
                    {m.match_date} {m.match_time}
                  </td>
                  <td>
                    {(isTeamsMode ? m.team_a : m.participant_a) || '—'} vs {(isTeamsMode ? m.team_b : m.participant_b) || '—'}
                  </td>
                  <td>
                    {m.score_a ?? '—'} : {m.score_b ?? '—'}
                  </td>
                  <td>
                    <span className="pill plan">{m.status}</span>
                  </td>
                  {isCommitteeUser && (
                    <td className="task-actions">
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setEditingMatch(m);
                          setMatchModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button className="btn danger" onClick={() => void handleDeleteMatch(m)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!tournament.matches.length && (
                <tr>
                  <td colSpan={isCommitteeUser ? 7 : 6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No matches scheduled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'live' && (
        <div>
          {pinnedUpdates.map((u) => (
            <div key={u.id} className="event-alert warning">
              <b>{u.title}</b> — {u.message}
            </div>
          ))}
          <h4 style={{ marginTop: 16 }}>Live / Recent Matches</h4>
          {liveMatches.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span>
                {(isTeamsMode ? m.team_a : m.participant_a) || '—'} vs {(isTeamsMode ? m.team_b : m.participant_b) || '—'}
              </span>
              <b>
                {m.score_a ?? 0} : {m.score_b ?? 0}
              </b>
            </div>
          ))}
          {!liveMatches.length && <p style={{ color: 'var(--muted)' }}>No live or recent matches.</p>}
          {!!tournament.winners.length && (
            <>
              <h4 style={{ marginTop: 16 }}>Winners</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tournament.winners.map((w) => (
                  <span key={w.id} className="pill done">
                    {w.position}: {w.winner_name}
                  </span>
                ))}
              </div>
            </>
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
              <div className="lbl">Matches Completed</div>
              <strong>{stats?.completedMatches ?? tournament.matches.filter((m) => m.status === 'Completed').length}</strong>
            </div>
            <div className="kpi">
              <div className="lbl">Pending Approvals</div>
              <strong>{stats?.pending ?? tournament.registrations.filter((r) => r.status === 'Pending Leader Approval').length}</strong>
            </div>
          </div>

          {isCommitteeUser && (
            <button className="btn primary" onClick={() => setWinnerModalOpen(true)}>
              + Add Winner
            </button>
          )}
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Position</th>
                <th>Winner</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {tournament.winners.map((w) => (
                <tr key={w.id}>
                  <td>{w.position}</td>
                  <td>{w.winner_name}</td>
                  <td>{w.remarks || '—'}</td>
                </tr>
              ))}
              {!tournament.winners.length && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No winners recorded yet.
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
      <MatchFormModal
        open={matchModalOpen}
        onClose={() => setMatchModalOpen(false)}
        tournamentId={tournament.id}
        isTeamsMode={isTeamsMode}
        teams={tournament.teams}
        editing={editingMatch}
        onSaved={onRefresh}
      />
      <WinnerFormModal
        open={winnerModalOpen}
        onClose={() => setWinnerModalOpen(false)}
        tournamentId={tournament.id}
        isTeamsMode={isTeamsMode}
        teams={tournament.teams}
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
