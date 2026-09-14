'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { useMyMeetings } from '../../../features/dashboard/useMyMeetings';
import { useDashboard } from '../../../features/dashboard/useDashboard';
import { markAllNotificationsRead, markNotificationRead, useNotifications } from '../../../features/notifications/useNotifications';
import { checkInToMeeting } from '../../../features/meetings/useMeetings';
import { canCheckInToMeeting } from '../../../features/meetings/status';
import { StaffDashboardPage } from '../../../features/portal/StaffDashboardPage';
import { useToast } from '../../../lib/ToastContext';

function money(n: number): string {
  return `MVR ${Math.round(n).toLocaleString()}`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}

export default function DashboardPage() {
  const { profile, session, isCommitteeUser, committeeChecked } = useAuth();
  if (!committeeChecked) return null;
  if (!isCommitteeUser) return <StaffDashboardPage />;
  return <ExecutiveDashboardPage profile={profile} session={session} />;
}

function ExecutiveDashboardPage({ profile, session }: { profile: ReturnType<typeof useAuth>['profile']; session: ReturnType<typeof useAuth>['session'] }) {
  const dash = useDashboard(profile);
  const { summaries, myCommitteeId, reload: reloadMeetings } = useMyMeetings(session?.user.id);
  const { notifications, reload: reloadNotifications } = useNotifications(session?.user.id);
  const toast = useToast();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const next = summaries[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const isToday = next?.meeting.meeting_date === today;
  const checkIn = next ? canCheckInToMeeting(next.meeting) : { allowed: false, reason: null };

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

  const shownNotifications = (unreadOnly ? notifications.filter((n) => !n.is_read) : notifications).slice(0, 5);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div>
      <div className="ub-page-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>UnitedBML Management Hub</h1>
        </div>
      </div>

      {next && (isToday || myCommitteeId) && (
        <div className="ub-card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ub-ink-faint)', marginBottom: 2 }}>NEXT MEETING</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{next.meeting.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginTop: 2 }}>
                {next.meeting.meeting_date} · {next.meeting.meeting_time} · {next.meeting.location || 'Venue TBC'} ·{' '}
                {next.totalCheckedIn}/{next.totalExpected} checked in
              </div>
            </div>
            {next.myAttendance?.attendance_status !== 'Present' && checkIn.allowed && (
              <button className="ub-btn ub-btn-primary" onClick={() => void handleCheckIn(next.meeting.id)} disabled={checkingInId === next.meeting.id}>
                {checkingInId === next.meeting.id ? 'Checking in…' : 'Check In'}
              </button>
            )}
            {next.myAttendance?.attendance_status !== 'Present' && !checkIn.allowed && checkIn.reason && (
              <span className="ub-pill ub-pill-neutral">{checkIn.reason}</span>
            )}
            {next.myAttendance?.attendance_status === 'Present' && <span className="ub-pill ub-pill-success">✓ Checked in</span>}
          </div>
        </div>
      )}

      <div className="ub-kpi-strip">
        <Link href="/events" className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{dash.metrics.activeEvents}</span>
          <span className="ub-kpi-strip-label">Active Events</span>
        </Link>
        <Link href="/finance" className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{dash.metrics.pendingApprovals}</span>
          <span className="ub-kpi-strip-label">Pending Approvals</span>
        </Link>
        <Link href="/events" className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{dash.metrics.openTasks}</span>
          <span className="ub-kpi-strip-label">Open Tasks</span>
        </Link>
        <Link href="/events-calendar" className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <CalendarIcon />
            {dash.metrics.upcoming30}
          </span>
          <span className="ub-kpi-strip-label">Coming Up (30d)</span>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ub-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Agenda</h3>
                <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginTop: 2 }}>Today and the days ahead, without the calendar clutter.</p>
              </div>
              <div className="ub-tabs" style={{ margin: 0 }}>
                <button className={`ub-tab ${dash.agendaRange === 7 ? 'active' : ''}`} onClick={() => dash.setAgendaRange(7)}>
                  7 Days
                </button>
                <button className={`ub-tab ${dash.agendaRange === 30 ? 'active' : ''}`} onClick={() => dash.setAgendaRange(30)}>
                  30 Days
                </button>
              </div>
            </div>
            {dash.loading && <p style={{ fontSize: 13, color: 'var(--ub-ink-faint)' }}>Loading…</p>}
            {!dash.loading && !dash.agenda.length && <p className="ub-empty">No events, meetings or matches in this period.</p>}
            {!dash.loading &&
              dash.agenda.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 4px',
                    borderBottom: '1px solid var(--ub-border-2)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 99,
                      background: item.type === 'event' ? 'var(--ub-accent)' : 'var(--ub-gold-dark)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>
                      {item.time ? `${item.time} · ` : ''}
                      {item.detail}
                    </div>
                  </div>
                  <span className="ub-pill ub-pill-neutral" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              ))}
          </div>

          <div className="ub-card">
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Priority Work</h3>
              <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginTop: 2, marginBottom: 14 }}>
                Tasks, approvals and exceptions needing action.
              </p>
            </div>
            {!dash.loading && !dash.priorityWork.length && <p className="ub-empty">No high-priority exceptions are currently open.</p>}
            {dash.priorityWork.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 4px',
                  borderBottom: '1px solid var(--ub-border-2)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: item.level === 'danger' ? 'var(--ub-danger)' : 'var(--ub-border)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>{item.detail}</div>
                </div>
                <span className={`ub-pill ${item.level === 'danger' ? 'ub-pill-danger' : 'ub-pill-neutral'}`}>{item.status}</span>
              </Link>
            ))}
          </div>

          <div className="ub-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Finance &amp; Approvals</h3>
                <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>Budget position and approval workload.</p>
              </div>
              <Link href="/finance" className="ub-btn ub-btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
                Finance →
              </Link>
            </div>
            <div className="ub-kpi-strip" style={{ margin: 0 }}>
              {[
                { label: 'Annual budget', value: money(dash.financeSnapshot.annualBudget) },
                { label: 'Available', value: money(dash.financeSnapshot.available) },
                { label: 'Approved spend', value: money(dash.financeSnapshot.approvedSpend) },
                { label: 'Pending value', value: money(dash.financeSnapshot.pendingValue) },
                { label: 'Pending requests', value: dash.financeSnapshot.pendingCount },
                { label: 'Open reimbursements', value: dash.financeSnapshot.openReimbursements },
              ].map((m) => (
                <div className="ub-kpi-strip-item" key={m.label}>
                  <span className="ub-kpi-strip-value">{m.value}</span>
                  <span className="ub-kpi-strip-label">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ub-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Notifications</h3>
                <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>Last 5 updates from across the hub.</p>
              </div>
              <button
                className="ub-btn ub-btn-ghost"
                style={{ fontSize: 12, padding: '5px 10px' }}
                onClick={() => setUnreadOnly((v) => !v)}
              >
                {unreadOnly ? 'Show all' : 'Unread only'}
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                className="ub-btn ub-btn-ghost"
                style={{ fontSize: 12, padding: '4px 8px', marginBottom: 8 }}
                onClick={() => session?.user.id && void markAllNotificationsRead(session.user.id).then(reloadNotifications)}
              >
                Mark all read
              </button>
            )}
            {!shownNotifications.length && <p className="ub-empty">{unreadOnly ? 'All caught up.' : 'No notifications.'}</p>}
            {shownNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => void markNotificationRead(n.id).then(reloadNotifications)}
                style={{
                  padding: '9px 6px',
                  borderBottom: '1px solid var(--ub-border-2)',
                  cursor: 'pointer',
                  background: n.is_read ? 'transparent' : 'var(--ub-accent-soft)',
                  borderRadius: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{n.title}</div>
                {n.message && <div style={{ fontSize: 12, color: 'var(--ub-ink-soft)', marginTop: 2 }}>{n.message}</div>}
                <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
              </div>
            ))}
          </div>

          <div className="ub-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Recent Activity</h3>
            <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginBottom: 12 }}>Last 5 updates across the hub.</p>
            {!dash.loading && !dash.recentActivity.length && <p className="ub-empty">No recent activity.</p>}
            {dash.recentActivity.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                style={{ display: 'flex', gap: 10, padding: '8px 4px', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--ub-border-2)' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--ub-border)', marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)' }}>
                    {item.detail} · {new Date(item.at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
