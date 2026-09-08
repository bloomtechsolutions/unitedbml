'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { EventPortalSettingsModal } from './EventPortalSettingsModal';
import { ReimbursementFormModal } from './ReimbursementFormModal';
import { TeamDetailModal } from './TeamDetailModal';
import type { PortalEvent } from './types';
import {
  computeEngagement,
  createEventTeam,
  requestJoinEventTeam,
  selfRegisterEvent,
  useEventAttendanceAll,
  useMyExternalReimbursements,
  useMyOfficialAssignments,
  usePendingExternalReimbursements,
  usePortalEvents,
} from './usePortal';

type SubTab = 'hub' | 'activities' | 'registrations' | 'engagement' | 'reimbursements';

function registrationStatusText(event: PortalEvent): string {
  if (!event.registration_enabled) return 'Registration not open';
  const now = new Date();
  if (event.registration_open_at && now < new Date(event.registration_open_at)) return 'Registration has not opened yet';
  if (event.registration_close_at && now > new Date(event.registration_close_at)) return 'Registration is closed';
  return '';
}

export function PortalPage() {
  const { profile, isCommitteeUser } = useAuth();
  const toast = useToast();
  const { events, loading, error, reload } = usePortalEvents(profile?.id);
  const attendance = useEventAttendanceAll();
  const { assignments } = useMyOfficialAssignments(profile?.id);
  const { items: myReimbursements, reload: reloadMyReimbursements } = useMyExternalReimbursements(profile?.id);
  const { items: pendingReimbursements } = usePendingExternalReimbursements();

  const [subTab, setSubTab] = useState<SubTab>('hub');
  const [teamTarget, setTeamTarget] = useState<{ event: PortalEvent; teamId: string } | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<PortalEvent | null>(null);
  const [reimbModalOpen, setReimbModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState<Record<string, string>>({});

  const registrable = events.filter((e) => e.registration_enabled);
  const myRegistrations = events.filter((e) => e.myRegistration);
  const engagement = computeEngagement(profile, events, attendance);

  const refresh = async () => {
    await reload();
  };

  const handleSelfRegister = async (eventId: string) => {
    try {
      await selfRegisterEvent(eventId, 'Individual');
      toast('Registered');
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to register.');
    }
  };

  const handleCreateTeam = async (eventId: string) => {
    const name = (newTeamName[eventId] || '').trim();
    if (!name) {
      toast('Enter a team name first.');
      return;
    }
    try {
      await createEventTeam(eventId, name);
      setNewTeamName((v) => ({ ...v, [eventId]: '' }));
      toast('Team created');
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create team.');
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    try {
      await requestJoinEventTeam(teamId);
      toast('Join request sent to the team leader');
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to request join.');
    }
  };

  if (loading) return <div>Loading Participant Portal…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load: {error}</div>;

  return (
    <div>
      <div className="portal-hero">
        <div>
          <div className="portal-kicker">Participant Portal</div>
          <h2>My Hub</h2>
          <p>Register for activities, manage your teams, and track your reimbursements.</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${subTab === 'hub' ? 'active' : ''}`} onClick={() => setSubTab('hub')}>
          My Hub
        </button>
        <button className={`tab ${subTab === 'activities' ? 'active' : ''}`} onClick={() => setSubTab('activities')}>
          Activities ({registrable.length})
        </button>
        <button className={`tab ${subTab === 'registrations' ? 'active' : ''}`} onClick={() => setSubTab('registrations')}>
          My Registrations ({myRegistrations.length})
        </button>
        <button className={`tab ${subTab === 'engagement' ? 'active' : ''}`} onClick={() => setSubTab('engagement')}>
          My Engagement
        </button>
        {assignments.length > 0 && (
          <button className={`tab ${subTab === 'reimbursements' ? 'active' : ''}`} onClick={() => setSubTab('reimbursements')}>
            My Reimbursements ({myReimbursements.length})
          </button>
        )}
      </div>

      {subTab === 'hub' && (
        <div className="portal-grid">
          <div className="portal-card">
            <div className="portal-card-head">
              <div>
                <h3>Upcoming Activities</h3>
                <p>Open for registration</p>
              </div>
              <button className="portal-link" onClick={() => setSubTab('activities')}>
                View all
              </button>
            </div>
            {registrable.slice(0, 6).map((e) => (
              <div className="portal-list-row" key={e.id}>
                <div className="portal-date-badge">
                  <b>{e.event_date ? new Date(e.event_date).getDate() : '—'}</b>
                  <small>{e.event_date ? new Date(e.event_date).toLocaleString('en-US', { month: 'short' }) : ''}</small>
                </div>
                <div>
                  <strong>{e.name}</strong>
                  <small>{e.venue || 'Venue TBC'}</small>
                </div>
                <span className={`portal-status ${e.myRegistration ? 'approved' : 'pending'}`}>
                  {e.myRegistration ? e.myRegistration.status : 'Open'}
                </span>
              </div>
            ))}
            {!registrable.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No activities open for registration right now.</div>}
          </div>
          <div className="portal-card">
            <div className="portal-card-head">
              <div>
                <h3>My Engagement</h3>
              </div>
            </div>
            <div className="portal-metric">
              <small>Level</small>
              <b>{engagement.level}</b>
              <span>{engagement.points} points</span>
            </div>
            {isCommitteeUser && pendingReimbursements.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12 }}>
                {pendingReimbursements.length} external reimbursement(s) awaiting Committee approval — see the
                Reimbursements module.
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'activities' && (
        <div className="portal-activity-grid">
          {events.map((e) => {
            const closedReason = registrationStatusText(e);
            return (
              <div className="portal-event-card" key={e.id}>
                <div className="portal-event-top">
                  <span className="portal-event-type">{e.event_type || 'Event'}</span>
                  <span className="portal-event-status">{e.status}</span>
                </div>
                <h3>{e.name}</h3>
                <div className="portal-event-meta">
                  {e.event_date ? new Date(e.event_date).toLocaleDateString() : 'Date TBC'} · {e.venue || 'Venue TBC'}
                </div>
                {e.participant_rules && <div className="portal-event-desc">{e.participant_rules}</div>}

                {e.registration_enabled && !closedReason && !e.myRegistration && e.registration_mode === 'Individual' && (
                  <div className="portal-event-actions">
                    <button className="btn primary" onClick={() => void handleSelfRegister(e.id)}>
                      Register
                    </button>
                  </div>
                )}

                {e.registration_enabled && !closedReason && !e.myRegistration && e.registration_mode === 'Teams' && (
                  <div className="portal-event-actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <input
                      placeholder="New team name"
                      value={newTeamName[e.id] || ''}
                      onChange={(ev) => setNewTeamName((v) => ({ ...v, [e.id]: ev.target.value }))}
                    />
                    <button className="btn primary" onClick={() => void handleCreateTeam(e.id)}>
                      Create Team
                    </button>
                    {e.teams
                      .filter((t) => t.status === 'Open')
                      .map((t) => (
                        <button key={t.id} className="btn ghost" onClick={() => void handleJoinTeam(t.id)}>
                          Request to join {t.team_name}
                        </button>
                      ))}
                  </div>
                )}

                {e.myRegistration && (
                  <div className="portal-event-actions">
                    <span className={`portal-status ${e.myRegistration.status === 'Approved' ? 'approved' : e.myRegistration.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                      {e.myRegistration.status}
                    </span>
                    {e.myRegistration.team_id && (
                      <button className="btn ghost" onClick={() => setTeamTarget({ event: e, teamId: e.myRegistration!.team_id! })}>
                        View Team
                      </button>
                    )}
                  </div>
                )}

                {closedReason && !e.myRegistration && <div className="portal-registration-closed">{closedReason}</div>}

                {isCommitteeUser && (
                  <div className="portal-event-actions" style={{ marginTop: 8 }}>
                    <button className="btn ghost" onClick={() => setSettingsTarget(e)}>
                      Configure
                    </button>
                  </div>
                )}

                {e.winners.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {e.winners.map((w) => (
                      <div className="portal-winner" key={w.id}>
                        <b>{w.position}</b>
                        <span>{w.winner_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!events.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No activities yet.</div>}
        </div>
      )}

      {subTab === 'registrations' && (
        <div>
          {myRegistrations.map((e) => (
            <div className="portal-registration-card" key={e.id}>
              <div className="portal-reg-head">
                <div>
                  <h3>{e.name}</h3>
                  <div className="portal-reg-meta">
                    {e.myRegistration?.registration_type} · {e.event_date ? new Date(e.event_date).toLocaleDateString() : 'Date TBC'}
                  </div>
                </div>
                <span className={`portal-status ${e.myRegistration?.status === 'Approved' ? 'approved' : e.myRegistration?.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                  {e.myRegistration?.status}
                </span>
              </div>
              {e.myRegistration?.team_id && (
                <div className="portal-reg-actions">
                  <button className="btn ghost" onClick={() => setTeamTarget({ event: e, teamId: e.myRegistration!.team_id! })}>
                    View Team
                  </button>
                </div>
              )}
            </div>
          ))}
          {!myRegistrations.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>You have not registered for any activities yet.</div>}
        </div>
      )}

      {subTab === 'engagement' && (
        <div>
          <div className="portal-engagement-grid">
            <div className="portal-eng-card">
              <b>{engagement.registrations}</b>
              <small>Approved Registrations (+3 each)</small>
            </div>
            <div className="portal-eng-card">
              <b>{engagement.attendances}</b>
              <small>Attendances Marked (+5 each)</small>
            </div>
            <div className="portal-eng-card">
              <b>{engagement.achievements}</b>
              <small>Achievements (+5 each)</small>
            </div>
            <div className="portal-eng-card">
              <b>{engagement.points}</b>
              <small>Total Points — {engagement.level}</small>
            </div>
          </div>
          <div className="portal-progress">
            <span style={{ width: `${Math.min(100, (engagement.points / 75) * 100)}%` }} />
          </div>
        </div>
      )}

      {subTab === 'reimbursements' && assignments.length > 0 && (
        <div>
          <div className="modal-actions" style={{ justifyContent: 'flex-start', marginBottom: 10 }}>
            <button className="btn primary" onClick={() => setReimbModalOpen(true)}>
              Submit Reimbursement
            </button>
          </div>
          {myReimbursements.map((r) => (
            <div className="portal-reimb-card" key={r.id}>
              <div className="portal-reimb-head">
                <h3>{r.title}</h3>
                <span className={`portal-status ${r.status === 'Approved for AP' || r.status === 'Paid' ? 'approved' : r.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                  {r.status}
                </span>
              </div>
              <div className="portal-reimb-meta">
                {r.expense_date} · {r.vendor_name || 'No vendor'} · ${r.amount.toFixed(2)}
              </div>
              <div className="portal-reimb-flow">
                {['Submitted', 'Committee', 'AP', 'Paid'].map((step, idx) => {
                  const stepIndex = r.status === 'Rejected' ? -1 : r.status === 'Paid' ? 3 : r.status === 'Approved for AP' ? 1 : 0;
                  return (
                    <div key={step} className={`portal-flow-step ${idx <= stepIndex ? 'done' : ''} ${idx === stepIndex + 1 ? 'current' : ''}`}>
                      {step}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!myReimbursements.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No reimbursements submitted yet.</div>}
        </div>
      )}

      <TeamDetailModal
        event={teamTarget?.event ?? null}
        teamId={teamTarget?.teamId ?? null}
        onClose={() => setTeamTarget(null)}
        onChanged={refresh}
      />
      <EventPortalSettingsModal event={settingsTarget} onClose={() => setSettingsTarget(null)} onSaved={refresh} />
      <ReimbursementFormModal
        open={reimbModalOpen}
        assignments={assignments}
        onClose={() => setReimbModalOpen(false)}
        onSubmitted={reloadMyReimbursements}
      />
    </div>
  );
}
