import type { CommitteeMemberRow } from '../../types/database';

export interface CommitteeMemberData {
  parentId?: string | null;
  displayOrder?: number;
  leaveUpdatedBy?: string;
  [key: string]: unknown;
}

export interface CommitteeMemberWithMeta extends CommitteeMemberRow {
  parentId: string | null;
  displayOrder: number;
}

export interface DirectoryUser {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  member_uid: string | null;
  contact_no: string | null;
}

export interface CommitteeTerm {
  start: string;
  end: string;
  updatedAt?: string;
}

export interface StaffProfilePreview {
  committeeId: string;
  userId: string | null;
  staffUid: string | null;
  name: string;
  jobTitle: string;
  division: string;
  department: string;
  unit: string;
  audienceCategory: string;
}

export type EffectiveAvailability = 'Vacant' | 'Leave Scheduled' | 'On Leave' | 'Leave Ended' | 'Available';

export const COMMITTEE_STATUS_OPTIONS = ['Active', 'Inactive'] as const;
export const COMMITTEE_AVAILABILITY_OPTIONS = ['Available', 'On Leave'] as const;
