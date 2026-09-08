'use client';

import { useState } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { useToast } from '../../../lib/ToastContext';
import { useMyMeetings } from '../../../features/dashboard/useMyMeetings';
import { meetingStatus } from '../../../features/meetings/status';
import { checkInToMeeting } from '../../../features/meetings/useMeetings';

export default function DashboardPage() {
  const { profile, session } = useAuth();
  const { summaries, myCommitteeId, loading, reload } = useMyMeetings(session?.user.id);
  const toast = useToast();
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const next = summaries[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const isToday = next?.meeting.meeting_date === today;

  const handleCheckIn = async (meetingId: string) => {
    setCheckingInId(meetingId);
    try {
      await checkInToMeeting(meetingId);
      await reload();
      toast("You're checked in");
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to check in.');
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <div>
      <div className="ub-page-head">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
          <p>UnitedBML Management Hub</p>
        </div>
      </div>

      {myCommitteeId && (
        <div className="ub-card" style={{ maxWidth: 560 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>My Meetings</h3>

          {loading && <p style={{ fontSize: 13.5, color: 'var(--ub-ink-faint)' }}>Loading…</p>}

          {!loading && !next && <p className="ub-empty">No upcoming meetings you're expected at.</p>}

          {!loading && next && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{next.meeting.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginTop: 4 }}>
                    {next.meeting.meeting_date} · {next.meeting.meeting_time} · {next.meeting.location || 'Venue TBC'}
                  </div>
                </div>
                <span className="ub-pill ub-pill-accent">{meetingStatus(next.meeting)}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--ub-surface-2)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 99,
                      background: 'var(--ub-success)',
                      width: `${next.totalExpected ? (next.totalCheckedIn / next.totalExpected) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, color: 'var(--ub-ink-faint)', whiteSpace: 'nowrap' }}>
                  {next.totalCheckedIn}/{next.totalExpected} checked in
                </span>
              </div>

              {isToday && next.myAttendance?.attendance_status !== 'Present' && (
                <button
                  className="ub-btn ub-btn-primary"
                  style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
                  onClick={() => void handleCheckIn(next.meeting.id)}
                  disabled={checkingInId === next.meeting.id}
                >
                  {checkingInId === next.meeting.id ? 'Checking in…' : 'Check In'}
                </button>
              )}
              {next.myAttendance?.attendance_status === 'Present' && (
                <div className="ub-banner ub-banner-success" style={{ marginTop: 16, marginBottom: 0 }}>
                  ✓ You're checked in
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
