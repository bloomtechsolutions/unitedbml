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

/** An item the event being created from this agenda item will need — carried onto the
 * event's `data.requiredItems` when the event is created, then pre-filled as expense
 * lines when an Expense Request is later raised for that event. */
export interface RequiredItem {
  id: string;
  description: string;
  category: string;
  estimatedAmount: number;
  reimbursable: boolean;
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
