import type { EventTaskRow, ExternalEventOfficialRow } from '../../types/database';

export interface MyTaskItem extends EventTaskRow {
  eventName: string;
}

export interface MyApprovalItem {
  id: string;
  title: string | null;
  request_number: string | null;
  status: string;
  total_amount: number;
  stage: 'President Recommendation' | 'Final Approval';
}

export interface OfficialAssignment extends ExternalEventOfficialRow {
  eventName: string;
}
