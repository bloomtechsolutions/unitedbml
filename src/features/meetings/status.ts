import type { MeetingRow } from '../../types/database';
import type { MeetingStatus } from './types';

export function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Mirrors meetingStatus() in the legacy index.html — status is always derived, never stored. */
export function meetingStatus(meeting: Pick<MeetingRow, 'cancelled' | 'minutes_finalized' | 'meeting_date'>): MeetingStatus {
  if (meeting.cancelled) return 'Cancelled';
  if (meeting.minutes_finalized) return 'Completed';
  const today = localTodayIso();
  if (!meeting.meeting_date || meeting.meeting_date > today) return 'Scheduled';
  if (meeting.meeting_date === today) return 'In Progress';
  return 'Minutes Pending';
}

export function isOverdue(dueDate: string | null, status: string): boolean {
  return !!dueDate && dueDate < localTodayIso() && status !== 'Completed';
}

export function isDueToday(dueDate: string | null, status: string): boolean {
  return dueDate === localTodayIso() && status !== 'Completed';
}

const CHECK_IN_OPENS_MINUTES_BEFORE = 5;

/** When self check-in opens for a meeting — 5 minutes before its scheduled start. Returns null
 * if the meeting has no date/time set yet. */
export function meetingCheckInOpensAt(meeting: Pick<MeetingRow, 'meeting_date' | 'meeting_time'>): Date | null {
  if (!meeting.meeting_date) return null;
  const start = new Date(`${meeting.meeting_date}T${meeting.meeting_time || '00:00:00'}`);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() - CHECK_IN_OPENS_MINUTES_BEFORE * 60_000);
}

/**
 * Self check-in is only meaningful in a fixed window: from 5 minutes before the meeting starts
 * until the meeting is closed (minutes finalized) or cancelled. Anyone who never checked in by
 * the time it closes is left Absent (see the mark_absent_on_meeting_close DB trigger) rather than
 * being able to check in after the fact.
 */
export function canCheckInToMeeting(
  meeting: Pick<MeetingRow, 'meeting_date' | 'meeting_time' | 'cancelled' | 'minutes_finalized'>,
  now: Date = new Date()
): { allowed: boolean; reason: string | null } {
  if (meeting.cancelled) return { allowed: false, reason: 'This meeting was cancelled.' };
  if (meeting.minutes_finalized) return { allowed: false, reason: 'This meeting has closed.' };
  const opensAt = meetingCheckInOpensAt(meeting);
  if (!opensAt) return { allowed: false, reason: null };
  if (now < opensAt) {
    return { allowed: false, reason: `Check-in opens at ${opensAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` };
  }
  return { allowed: true, reason: null };
}
