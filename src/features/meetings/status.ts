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
