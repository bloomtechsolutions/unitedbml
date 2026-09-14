'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { checkInToMeeting } from '../meetings/useMeetings';
import { canCheckInToMeeting } from '../meetings/status';
import { useMyMeetings } from '../dashboard/useMyMeetings';
import { useLeaderboard } from '../leaderboard/useLeaderboard';
import { ReimbursementFormModal } from './ReimbursementFormModal';
import { StaffPortalPage } from './StaffPortalPage';
import {
  useMyCommitteeId,
  useMyExternalReimbursements,
  useMyOfficialAssignments,
  useMyOpenTasks,
  useMyPendingApprovals,
} from './usePortal';

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

const ACTIVITY_ICON: Record<string, string> = { event: '◉', task: '✓', win: '★' };

export function PortalPage() {
  const { isCommitteeUser, committeeChecked } = useAuth();
  if (!committeeChecked) return null;
  if (!isCommitteeUser) return <StaffPortalPage />;
  return <CommitteePortalPage />;
}

function CommitteePortalPage() {
  const { profile, session } = useAuth();
  const toast = useToast();
  const committeeId = useMyCommitteeId(session?.user.id);
  const { tasks: myTasks, loading: tasksLoading } = useMyOpenTasks(committeeId);
  const { items: myApprovals, loading: approvalsLoading } = useMyPendingApprovals(profile);
  const { summaries: myMeetings, loading: meetingsLoading, reload: reloadMeetings } = useMyMeetings(session?.user.id);
  const { rows: leaderboardRows, loading: leaderboardLoading } = useLeaderboard();
  const { assignments } = useMyOfficialAssignments(profile?.id);
  const { items: myReimbursements, reload: reloadMyReimbursements } = useMyExternalReimbursements(profile?.id);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [reimbModalOpen, setReimbModalOpen] = useState(false);

  const myKey = normalize(profile?.member_uid) ? `uid:${normalize(profile?.member_uid)}` : normalize(profile?.email) ? `email:${normalize(profile?.email)}` : `name:${normalize(profile?.full_name)}`;
  const myRow = leaderboardRows.find((r) => r.key === myKey || normalize(r.name) === normalize(profile?.full_name)) ?? null;
  const myActivity = myRow?.activity ?? [];

  const today = new Date().toISOString().slice(0, 10);

  const handleCheckIn = async (meetingId: string) => {
    setCheckingInId(meetingId);
    try {
      await checkInToMeeting(meetingId);
      await reloadMeetings();
      toast("You're checked in");
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to check in.');
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          background: 'linear-gradient(120deg, var(--ub-ink), var(--ub-accent-dark))',
          color: '#fff',
          padding: '22px 26px',
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 12.5, opacity: 0.85 }}>MY HUB</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '6px 0' }}>Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h2>
        <p style={{ fontSize: 13.5, opacity: 0.9 }}>Your tasks, approvals, meetings and activity — in one place.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ub-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>My Open Tasks</h3>
                <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginTop: 2 }}>Event preparation tasks assigned to you.</p>
              </div>
              <span className="ub-pill ub-pill-neutral">{myTasks.length}</span>
            </div>
            {!tasksLoading && !myTasks.length && <p className="ub-empty">No open tasks assigned to you.</p>}
            {myTasks.map((t) => (
              <Link
                key={t.id}
                href="/events"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 4px',
                  borderBottom: '1px solid var(--ub-border-2)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.task_text}</div>
                  <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>{t.eventName}</div>
                </div>
                <span className={`ub-pill ${t.due_date && t.due_date < today ? 'ub-pill-danger' : 'ub-pill-neutral'}`}>
                  {t.due_date || 'No due date'}
                </span>
              </Link>
            ))}
          </div>

          <div className="ub-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Pending My Approval</h3>
                <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginTop: 2 }}>Finance requests waiting on your decision.</p>
              </div>
              <span className="ub-pill ub-pill-neutral">{myApprovals.length}</span>
            </div>
            {!approvalsLoading && !myApprovals.length && <p className="ub-empty">Nothing waiting on your decision.</p>}
            {myApprovals.map((r) => (
              <Link
                key={r.id}
                href={r.href ?? '/finance'}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 4px',
                  borderBottom: '1px solid var(--ub-border-2)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.title || r.request_number}</div>
                  <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>{r.stage} · MVR {r.total_amount.toLocaleString()}</div>
                </div>
                <span className="ub-pill ub-pill-warning">{r.status}</span>
              </Link>
            ))}
          </div>

          <div className="ub-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Upcoming Meetings</h3>
                <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginTop: 2 }}>Meetings you're invited to.</p>
              </div>
              <span className="ub-pill ub-pill-neutral">{myMeetings.length}</span>
            </div>
            {!meetingsLoading && !myMeetings.length && <p className="ub-empty">No upcoming meetings.</p>}
            {myMeetings.map((s) => {
              const checkedIn = s.myAttendance?.attendance_status === 'Present';
              const checkIn = canCheckInToMeeting(s.meeting);
              return (
                <div
                  key={s.meeting.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 4px',
                    borderBottom: '1px solid var(--ub-border-2)',
                  }}
                >
                  <Link href={`/meetings?open=${s.meeting.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.meeting.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>
                      {s.meeting.meeting_date} · {s.meeting.meeting_time} · {s.meeting.location || 'Venue TBC'}
                    </div>
                  </Link>
                  {!checkedIn && checkIn.allowed && (
                    <button
                      className="ub-btn ub-btn-primary"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      disabled={checkingInId === s.meeting.id}
                      onClick={() => void handleCheckIn(s.meeting.id)}
                    >
                      {checkingInId === s.meeting.id ? 'Checking in…' : 'Check In'}
                    </button>
                  )}
                  {!checkedIn && !checkIn.allowed && checkIn.reason && (
                    <small style={{ color: 'var(--ub-ink-faint)', whiteSpace: 'nowrap' }}>{checkIn.reason}</small>
                  )}
                  {checkedIn && <span className="ub-pill ub-pill-success">✓ Checked in</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ub-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Recent Activity</h3>
            <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginBottom: 14 }}>Your own event attendance, tasks and achievements.</p>
            {leaderboardLoading && <p style={{ fontSize: 13, color: 'var(--ub-ink-faint)' }}>Loading…</p>}
            {!leaderboardLoading && !myActivity.length && <p className="ub-empty">No activity recorded yet.</p>}
            {!leaderboardLoading &&
              myActivity.slice(0, 8).map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 4px',
                    borderBottom: '1px solid var(--ub-border-2)',
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: 'var(--ub-surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none',
                      fontSize: 13,
                    }}
                  >
                    {ACTIVITY_ICON[a.type] ?? '•'}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)' }}>{a.detail}</div>
                  </div>
                  <strong style={{ fontSize: 12.5, color: 'var(--ub-accent-dark)', flex: 'none' }}>+{a.points}</strong>
                </div>
              ))}
          </div>

          {assignments.length > 0 && (
            <div className="ub-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>My Reimbursements</h3>
                  <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginTop: 2 }}>As an assigned external official.</p>
                </div>
                <button className="ub-btn ub-btn-primary" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => setReimbModalOpen(true)}>
                  Submit
                </button>
              </div>
              {!myReimbursements.length && <p className="ub-empty">No reimbursements submitted yet.</p>}
              {myReimbursements.map((r) => (
                <div key={r.id} style={{ padding: '8px 4px', borderBottom: '1px solid var(--ub-border-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 13 }}>{r.title}</b>
                    <span
                      className={`ub-pill ${r.status === 'Approved for AP' || r.status === 'Paid' ? 'ub-pill-success' : r.status === 'Rejected' ? 'ub-pill-danger' : 'ub-pill-warning'}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)', marginTop: 2 }}>
                    {r.expense_date} · MVR {r.amount.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ReimbursementFormModal
        open={reimbModalOpen}
        assignments={assignments}
        onClose={() => setReimbModalOpen(false)}
        onSubmitted={reloadMyReimbursements}
      />
    </div>
  );
}
