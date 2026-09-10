'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { useToast } from '../../../lib/ToastContext';
import { useMyMeetings } from '../../../features/dashboard/useMyMeetings';
import { useDashboard } from '../../../features/dashboard/useDashboard';
import { markAllNotificationsRead, markNotificationRead, useNotifications } from '../../../features/notifications/useNotifications';
import { checkInToMeeting } from '../../../features/meetings/useMeetings';

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

export default function DashboardPage() {
  const { profile, session } = useAuth();
  const dash = useDashboard(profile);
  const { summaries, myCommitteeId, reload: reloadMeetings } = useMyMeetings(session?.user.id);
  const { notifications, unreadCount, reload: reloadNotifications } = useNotifications(session?.user.id);
  const toast = useToast();

  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const next = summaries[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const isToday = next?.meeting.meeting_date === today;
  const isMy = dash.view === 'My';

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

  const shownNotifications = unreadOnly ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div>
      <div className="ub-page-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ub-ink-faint)', marginBottom: 4 }}>
            UNITEDBML MANAGEMENT HUB
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>{isMy ? 'My Dashboard' : 'Executive Dashboard'}</h1>
          <p>
            {isMy
              ? `Welcome${profile?.full_name ? `, ${profile.full_name}` : ''}. Your tasks, notifications, meetings and activity in one place.`
              : 'A compact view of what needs attention, what is coming next and how UnitedBML is performing.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="ub-tabs" style={{ margin: 0 }}>
            <button className={`ub-tab ${!isMy ? 'active' : ''}`} onClick={() => dash.setView('Executive')}>
              Executive
            </button>
            <button className={`ub-tab ${isMy ? 'active' : ''}`} onClick={() => dash.setView('My')}>
              My Dashboard
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <button className="ub-btn ub-btn-primary" onClick={() => setQuickMenuOpen((v) => !v)}>
              + New
            </button>
            {quickMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setQuickMenuOpen(false)} />
                <div className="ub-card" style={{ position: 'absolute', right: 0, top: 44, width: 220, zIndex: 31, padding: 6 }}>
                  {[
                    { href: '/events?new=1', label: 'New Event', small: 'Create an activity' },
                    { href: '/meetings?new=1', label: 'New Meeting', small: 'Schedule committee work' },
                    { href: '/finance?new=1', label: 'New Expense', small: 'Start finance approval' },
                    { href: '/reimbursements', label: 'Reimbursement', small: 'Open reimbursement workspace' },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setQuickMenuOpen(false)}
                      style={{ display: 'block', padding: '8px 10px', borderRadius: 8, textDecoration: 'none' }}
                      className="ub-menu-item"
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ub-ink)' }}>{item.label}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)' }}>{item.small}</div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
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
            {isToday && next.myAttendance?.attendance_status !== 'Present' && (
              <button className="ub-btn ub-btn-primary" onClick={() => void handleCheckIn(next.meeting.id)} disabled={checkingInId === next.meeting.id}>
                {checkingInId === next.meeting.id ? 'Checking in…' : 'Check In'}
              </button>
            )}
            {next.myAttendance?.attendance_status === 'Present' && <span className="ub-pill ub-pill-success">✓ Checked in</span>}
          </div>
        </div>
      )}

      <div className="ub-kpi-row">
        <Link href="/events" className="ub-card ub-kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="ub-kpi-value">{dash.metrics.activeEvents}</div>
          <div className="ub-kpi-label">Active Events</div>
        </Link>
        <Link href="/finance" className="ub-card ub-kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="ub-kpi-value">{dash.metrics.pendingApprovals}</div>
          <div className="ub-kpi-label">Pending Approvals</div>
        </Link>
        <Link href="/events" className="ub-card ub-kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="ub-kpi-value">{dash.metrics.openTasks}</div>
          <div className="ub-kpi-label">Open Tasks</div>
        </Link>
        <div className="ub-card ub-kpi">
          <div className="ub-kpi-value">{unreadCount}</div>
          <div className="ub-kpi-label">Notifications</div>
        </div>
        <div className="ub-card ub-kpi">
          <div className="ub-kpi-value">{dash.metrics.upcoming30}</div>
          <div className="ub-kpi-label">Next 30 Days</div>
        </div>
        <Link href="/finance" className="ub-card ub-kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="ub-kpi-value">{money(dash.metrics.available)}</div>
          <div className="ub-kpi-label">{dash.metrics.budgetPct.toFixed(0)}% Budget Available</div>
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
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>{isMy ? 'My Priority Work' : 'Priority Work'}</h3>
              <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginTop: 2, marginBottom: 14 }}>
                {isMy ? 'Your tasks, approvals and requests requiring action.' : 'Tasks, approvals and exceptions needing action.'}
              </p>
            </div>
            {!dash.loading && !dash.priorityWork.length && (
              <p className="ub-empty">{isMy ? 'You have no outstanding priority work.' : 'No high-priority exceptions are currently open.'}</p>
            )}
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

          {!isMy && (
            <div className="ub-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Engagement &amp; Delivery</h3>
              <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginBottom: 14 }}>Compact management indicators across activities and finance.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
                {[
                  { label: 'Active activities', value: dash.engagement.activeEvents },
                  { label: 'Attendance records', value: dash.engagement.totalAttendance },
                  { label: 'Task completion', value: `${dash.engagement.taskCompletionPct}%` },
                  { label: 'Reimbursement cases', value: dash.engagement.reimbursementCases },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{item.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--ub-surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '55%', background: 'var(--ub-accent)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ub-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Notifications</h3>
                <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>Updates collected from across the hub.</p>
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
            {shownNotifications.slice(0, 10).map((n) => (
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

          {isMy && (
            <div className="ub-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>My Shortcuts</h3>
              <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginBottom: 12 }}>Jump directly to your common work.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { href: '/events', label: 'My Events', small: 'Assigned activities' },
                  { href: '/meetings', label: 'My Meetings', small: 'Actions & minutes' },
                  { href: '/reimbursements', label: 'My Requests', small: 'Reimbursement status' },
                ].map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="ub-card"
                    style={{ textDecoration: 'none', color: 'inherit', padding: 12 }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)' }}>{s.small}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="ub-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Recent Activity</h3>
            <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginBottom: 12 }}>A concise activity stream.</p>
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

      {!isMy && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
              {[
                { label: 'Annual budget', value: money(dash.financeSnapshot.annualBudget) },
                { label: 'Available', value: money(dash.financeSnapshot.available) },
                { label: 'Approved spend', value: money(dash.financeSnapshot.approvedSpend) },
                { label: 'Pending value', value: money(dash.financeSnapshot.pendingValue) },
                { label: 'Pending requests', value: dash.financeSnapshot.pendingCount },
                { label: 'Open reimbursements', value: dash.financeSnapshot.openReimbursements },
              ].map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)' }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ub-card">
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Operational Pulse</h3>
              <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>Events, meetings and reimbursements status.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
              {[
                { label: 'Active events', value: dash.operationalPulse.activeEvents },
                { label: 'Upcoming meetings', value: dash.operationalPulse.upcomingMeetings },
                { label: 'Open reimbursements', value: dash.operationalPulse.openReimbursements },
                { label: 'Overdue tasks', value: dash.operationalPulse.overdueTasks },
              ].map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)' }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
