export type UserRole =
  | 'Administrator'
  | 'President'
  | 'Vice President'
  | 'Committee Member'
  | 'Staff Member'
  | string;

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  committee_slot: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  name: string;
  event_type: string | null;
  status: string | null;
  auto_status: string | null;
  manual_state: string | null;
  event_date: string | null;
  event_time: string | null;
  venue: string | null;
  coordinator: string | null;
  coordinator_role: string | null;
  coordinator_committee_id: string | null;
  expected_participants: number;
  attendance_count: number;
  planned_budget: number;
  description: string | null;
  archived: boolean;
  archived_at: string | null;
  archive_reason: string | null;
  cancelled_at: string | null;
  finance_settlement_status: string | null;
  settlement_reference: string | null;
  actual_expense_total: number;
  actual_expense_remarks: string | null;
  actual_entered_by: string | null;
  actual_entered_at: string | null;
  finance_closed_at: string | null;
  attendance_updated_at: string | null;
  source_meeting_id: string | null;
  source_meeting_title: string | null;
  source_meeting_date: string | null;
  source_agenda_id: string | null;
  source_agenda_title: string | null;
  source_agenda_outcome: string | null;
  created_by: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EventTaskRow {
  id: string;
  event_id: string;
  source_key: string;
  task_text: string;
  owner: string | null;
  owner_role: string | null;
  owner_committee_id: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  done: boolean;
  notes: string | null;
  remarks: string | null;
  availability: string | null;
  source_meeting_id: string | null;
  source_meeting_action_id: string | null;
  source_meeting_action_status: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EventAttendanceRow {
  id: string;
  event_id: string;
  staff_uid: string;
  staff_name: string;
  contact_no: string | null;
  attendance_status: string;
  attended: boolean;
  marked_at: string | null;
  marked_by: string | null;
  data: Record<string, unknown>;
}

export interface EventTypeRow {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      events: { Row: EventRow; Insert: Partial<EventRow>; Update: Partial<EventRow> };
      event_tasks: { Row: EventTaskRow; Insert: Partial<EventTaskRow>; Update: Partial<EventTaskRow> };
      event_attendance: {
        Row: EventAttendanceRow;
        Insert: Partial<EventAttendanceRow>;
        Update: Partial<EventAttendanceRow>;
      };
      event_types: { Row: EventTypeRow; Insert: Partial<EventTypeRow>; Update: Partial<EventTypeRow> };
    };
  };
}
