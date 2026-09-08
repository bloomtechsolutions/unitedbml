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
  member_uid: string | null;
  contact_no: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommitteeMemberRow {
  id: string;
  role: string;
  group_name: string | null;
  icon: string | null;
  name: string | null;
  uid: string | null;
  contact: string | null;
  email: string | null;
  term_start: string | null;
  term_end: string | null;
  status: string;
  availability: string;
  leave_from: string | null;
  leave_to: string | null;
  notes: string | null;
  user_id: string | null;
  staff_uid: string | null;
  data: Record<string, unknown>;
  updated_at: string;
}

export interface AppSettingRow {
  setting_key: string;
  setting_value: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
}

export interface StaffRow {
  id: string;
  uid: string;
  full_name: string;
  contact_no: string | null;
  email: string | null;
  status: string;
  job_title: string | null;
  division: string | null;
  department: string | null;
  unit: string | null;
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

export interface MeetingRow {
  id: string;
  title: string;
  meeting_type: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  location: string | null;
  chair: string | null;
  secretary: string | null;
  purpose: string | null;
  status: string | null;
  minutes_finalized: boolean;
  minutes_finalized_at: string | null;
  cancelled: boolean;
  cancelled_at: string | null;
  minutes: string | null;
  created_by: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendeeRow {
  id: string;
  meeting_id: string;
  source_key: string;
  committee_id: string | null;
  attendee_name: string;
  attendee_uid: string | null;
  attendee_role: string | null;
  attendance_status: string | null;
  data: Record<string, unknown>;
}

export interface MeetingAgendaRow {
  id: string;
  source_key: string;
  meeting_id: string;
  sort_order: number;
  title: string;
  owner: string | null;
  minutes_allocated: number;
  outcome: string | null;
  details: string | null;
  discussion: string | null;
  event_id: string | null;
  finance_id: string | null;
  created_event_id: string | null;
  carry_forward: boolean;
  source_meeting_id: string | null;
  source_meeting_title: string | null;
  source_agenda_id: string | null;
  source_agenda_title: string | null;
  source_action_id: string | null;
  source_action_text: string | null;
  created_at: string;
  data: Record<string, unknown>;
}

export interface MeetingDecisionRow {
  id: string;
  source_key: string;
  meeting_id: string;
  agenda_id: string | null;
  decision_text: string;
  outcome: string | null;
  owner: string | null;
  event_id: string | null;
  created_at: string;
  data: Record<string, unknown>;
}

export interface MeetingActionRow {
  id: string;
  source_key: string;
  meeting_id: string;
  agenda_id: string | null;
  action_text: string;
  assigned_to: string | null;
  assigned_role: string | null;
  due_date: string | null;
  priority: string | null;
  status: string;
  done: boolean;
  event_id: string | null;
  remarks: string | null;
  progress_note: string | null;
  carried_forward_from: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MeetingActionHistoryRow {
  id: string;
  meeting_action_id: string;
  action: string | null;
  old_status: string | null;
  new_status: string | null;
  remarks: string | null;
  changed_by: string | null;
  actor_name: string | null;
  changed_at: string;
  data: Record<string, unknown>;
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
      committee_members: {
        Row: CommitteeMemberRow;
        Insert: Partial<CommitteeMemberRow>;
        Update: Partial<CommitteeMemberRow>;
      };
      app_settings: { Row: AppSettingRow; Insert: Partial<AppSettingRow>; Update: Partial<AppSettingRow> };
      staff: { Row: StaffRow; Insert: Partial<StaffRow>; Update: Partial<StaffRow> };
      meetings: { Row: MeetingRow; Insert: Partial<MeetingRow>; Update: Partial<MeetingRow> };
      meeting_attendees: {
        Row: MeetingAttendeeRow;
        Insert: Partial<MeetingAttendeeRow>;
        Update: Partial<MeetingAttendeeRow>;
      };
      meeting_agenda: { Row: MeetingAgendaRow; Insert: Partial<MeetingAgendaRow>; Update: Partial<MeetingAgendaRow> };
      meeting_decisions: {
        Row: MeetingDecisionRow;
        Insert: Partial<MeetingDecisionRow>;
        Update: Partial<MeetingDecisionRow>;
      };
      meeting_actions: { Row: MeetingActionRow; Insert: Partial<MeetingActionRow>; Update: Partial<MeetingActionRow> };
      meeting_action_history: {
        Row: MeetingActionHistoryRow;
        Insert: Partial<MeetingActionHistoryRow>;
        Update: Partial<MeetingActionHistoryRow>;
      };
    };
  };
}
