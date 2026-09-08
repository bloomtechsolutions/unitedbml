import type {
  MeetingActionRow,
  MeetingAgendaRow,
  MeetingAttendeeRow,
  MeetingDecisionRow,
  MeetingRow,
} from '../../types/database';

export interface MeetingWithChildren extends MeetingRow {
  attendees: MeetingAttendeeRow[];
  agenda: MeetingAgendaRow[];
  decisions: MeetingDecisionRow[];
  actions: MeetingActionRow[];
}

export const MEETING_TYPES = [
  'EXCO Meeting',
  'Planning Meeting',
  'Event Review',
  'Finance Review',
  'Special Meeting',
  'Other',
] as const;

export const MEETING_STATUSES = ['Scheduled', 'In Progress', 'Minutes Pending', 'Completed', 'Cancelled'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const ACTION_STATUSES = ['Open', 'In Progress', 'Completed', 'Deferred'] as const;
export const ACTION_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;

export const ATTENDANCE_STATUSES = ['Expected', 'Present', 'Absent', 'Excused'] as const;
