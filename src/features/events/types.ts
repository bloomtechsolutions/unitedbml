import type { EventAttendanceRow, EventRow, EventTaskRow } from '../../types/database';

export interface EventWithChildren extends EventRow {
  tasks: EventTaskRow[];
  attendance: EventAttendanceRow[];
}

export interface CommitteeMemberOption {
  id: string;
  name: string | null;
  role: string;
  status: string;
}

export interface StaffOption {
  id: string;
  uid: string;
  full_name: string;
  contact_no: string | null;
}

export const EVENT_AUDIENCE_OPTIONS = ['ALL_STAFF', 'MALE_BASED', 'ATOLL_BASED'] as const;

export const TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
