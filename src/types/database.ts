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
  avatar_url: string | null;
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
  audience_type: string;
  registration_enabled: boolean;
  registration_mode: string;
  registration_open_at: string | null;
  registration_close_at: string | null;
  participant_rules: string | null;
  participant_capacity: number | null;
  team_size: number | null;
  participant_visibility: string;
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

export interface BudgetRow {
  id: string;
  budget_year: number;
  category: string;
  approved_amount: number;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface ExpenseRequestRow {
  id: string;
  request_number: string | null;
  title: string | null;
  event_id: string | null;
  event_name: string | null;
  request_date: string | null;
  category: string | null;
  purpose: string | null;
  requested_by: string | null;
  requester_role: string | null;
  requested_by_user: string | null;
  prepared_by_name: string | null;
  prepared_by_role: string | null;
  prepared_at: string | null;
  submitted_at: string | null;
  status: string;
  subtotal: number;
  contingency_percent: number;
  contingency_amount: number;
  total_amount: number;
  president_availability: string | null;
  president_recommendation: string | null;
  president_comment: string | null;
  recommended_by_name: string | null;
  recommended_by_role: string | null;
  final_approver_name: string | null;
  final_approver_role: string | null;
  final_approver_email: string | null;
  final_approver_comment: string | null;
  approved_by_name: string | null;
  approved_by_role: string | null;
  approved_at: string | null;
  planned_event_budget: number;
  previous_approved_event_spend: number;
  projected_event_spend: number;
  over_budget: boolean;
  overrun_amount: number;
  overrun_justification: string | null;
  budget_available_before_approval: number | null;
  budget_available_after_approval: number | null;
  reversal_status: string | null;
  reversal_reason: string | null;
  reversal_requested_by: string | null;
  reversal_requested_at: string | null;
  reversal_president_comment: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  actual_expense_total: number;
  actual_expense_remarks: string | null;
  actual_entered_by: string | null;
  actual_entered_at: string | null;
  finance_settlement_status: string;
  finance_closed_at: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EventActualExpenseRow {
  id: string;
  event_id: string | null;
  settlement_key: string;
  line_type: string;
  source_key: string;
  expense_item: string;
  approved_amount: number;
  actual_amount: number;
  variance_amount: number;
  vendor_number: string | null;
  vendor_name: string | null;
  reference: string | null;
  entered_by: string | null;
  source_type: string | null;
  expense_request_id: string | null;
  expense_line_no: number | null;
  reimbursement_reference: string | null;
  ap_status: string | null;
  is_reimbursement: boolean;
  manual_entered: boolean;
  data: Record<string, unknown>;
  created_at: string;
}

export interface ContingencyRequestRow {
  id: string;
  ref: string;
  event_id: string | null;
  event_name: string | null;
  expense_request_id: string;
  expense_request_number: string | null;
  line_index: number;
  expense_item: string;
  original_approved_amount: number;
  contingency_available_at_request: number;
  requested_amount: number;
  reason: string;
  status: string;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_by_role: string | null;
  requested_by_email: string | null;
  requested_at: string;
  president_recommendation: string | null;
  president_by: string | null;
  president_at: string | null;
  procurement_to: string | null;
  procurement_subject: string | null;
  procurement_email_sent_at: string | null;
  procurement_decision: string | null;
  procurement_response_date: string | null;
  procurement_response_by: string | null;
  procurement_response_attachment_path: string | null;
  procurement_response_attachment_name: string | null;
  procurement_response_attachment_type: string | null;
  procurement_response_attachment_size: number;
  released_amount: number;
  released_at: string | null;
  released_by: string | null;
  history: { at: string; status: string; note?: string }[];
  created_at: string;
  updated_at: string;
}

export interface ExpenseLineRow {
  id: string;
  expense_request_id: string;
  line_no: number;
  description: string;
  quantity: number;
  rate: number;
  line_total: number;
  vendor_number: string | null;
  vendor: string | null;
  reimbursement_required: boolean;
  data: Record<string, unknown>;
}

export interface ExpenseApprovalRow {
  id: string;
  expense_request_id: string;
  stage: string;
  decision: string;
  approver_name: string | null;
  approver_role: string | null;
  approver_user: string | null;
  comment: string | null;
  channel: string | null;
  decided_at: string;
  data: Record<string, unknown>;
}

export interface ExpenseReversalRow {
  id: string;
  expense_request_id: string;
  requested_by: string | null;
  requested_by_name: string | null;
  reason: string;
  status: string;
  president_comment: string | null;
  decided_by: string | null;
  decided_by_name: string | null;
  requested_at: string;
  decided_at: string | null;
  data: Record<string, unknown>;
}

export interface ReimbursementCaseRow {
  id: string;
  case_ref: string | null;
  reference_no: string | null;
  expense_request_id: string | null;
  expense_request_number: string | null;
  expense_line_no: number | null;
  event_id: string | null;
  event_name: string | null;
  expense_item: string | null;
  approved_item_amount: number;
  route: string;
  status: string;
  reason: string | null;
  expected_expense_date: string | null;
  notes: string | null;
  requested_by: string | null;
  procurement_manager_email: string | null;
  procurement_head_email: string | null;
  email_reference: string | null;
  email_attachment_name: string | null;
  email_prepared_at: string | null;
  email_sent_at: string | null;
  procurement_comment: string | null;
  procurement_response_by: string | null;
  procurement_response_date: string | null;
  exception_ref: string | null;
  exception_reason: string | null;
  exception_remarks: string | null;
  exception_expense_date: string | null;
  recorded_by: string | null;
  recorded_at: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReimbursementHistoryRow {
  id: string;
  reimbursement_id: string;
  action: string | null;
  status: string | null;
  remarks: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
  data: Record<string, unknown>;
}

export interface ApBatchRow {
  id: string;
  reimbursement_id: string;
  submission_ref: string | null;
  submission_date: string | null;
  status: string;
  ap_email: string | null;
  email_remarks: string | null;
  bills_attachment_name: string | null;
  bills_attachment_type: string | null;
  bills_attachment_stored: boolean;
  bills_attachment_path: string | null;
  sent_at: string | null;
  status_date: string | null;
  status_remarks: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApBillRow {
  id: string;
  ap_batch_id: string;
  line_no: number;
  bill_date: string | null;
  vendor_number: string | null;
  vendor_name: string | null;
  worker_id: string | null;
  amount: number;
  data: Record<string, unknown>;
}

export interface VendorMasterRow {
  vendor_account: string;
  name: string;
  worker_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TournamentRow {
  id: string;
  event_id: string;
  source_expense_request_id: string | null;
  name: string;
  tournament_mode: string;
  sport: string | null;
  rules: string | null;
  status: string;
  registration_open: string | null;
  registration_close: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  max_participants: number | null;
  max_teams: number | null;
  team_size: number | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TournamentTeamRow {
  id: string;
  tournament_id: string;
  team_name: string;
  join_code: string;
  leader_user_id: string;
  leader_uid: string | null;
  leader_name: string;
  leader_email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TournamentRegistrationRow {
  id: string;
  tournament_id: string;
  user_id: string;
  staff_uid: string | null;
  staff_name: string;
  email: string | null;
  contact_no: string | null;
  department: string | null;
  registration_type: string;
  team_id: string | null;
  status: string;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  data: Record<string, unknown>;
}

export interface TournamentTeamMessageRow {
  id: string;
  tournament_id: string;
  team_id: string;
  user_id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface TournamentUpdateRow {
  id: string;
  tournament_id: string;
  update_type: string;
  title: string;
  message: string;
  is_pinned: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface TournamentMatchRow {
  id: string;
  tournament_id: string;
  match_no: number | null;
  stage: string | null;
  match_date: string | null;
  match_time: string | null;
  venue: string | null;
  team_a: string | null;
  team_b: string | null;
  participant_a: string | null;
  participant_b: string | null;
  score_a: number | null;
  score_b: number | null;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentWinnerRow {
  id: string;
  tournament_id: string;
  position: string;
  winner_name: string;
  team_id: string | null;
  staff_uid: string | null;
  remarks: string | null;
  created_at: string;
}

export interface StaffLocationClassificationRow {
  id: string;
  match_type: string;
  match_value: string;
  audience_category: string;
  notes: string | null;
  active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface EventTeamRow {
  id: string;
  event_id: string;
  team_name: string;
  leader_user_id: string;
  leader_name: string | null;
  leader_email: string | null;
  join_code: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EventRegistrationRow {
  id: string;
  event_id: string;
  user_id: string;
  staff_uid: string | null;
  staff_name: string | null;
  email: string | null;
  contact_no: string | null;
  department: string | null;
  registration_type: string;
  team_id: string | null;
  status: string;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  data: Record<string, unknown>;
}

export interface EventTeamMessageRow {
  id: string;
  event_id: string;
  team_id: string;
  user_id: string;
  sender_name: string | null;
  message: string;
  created_at: string;
}

export interface EventWinnerRow {
  id: string;
  event_id: string;
  position: string;
  winner_name: string;
  team_id: string | null;
  staff_uid: string | null;
  remarks: string | null;
  created_at: string;
}

export interface ExternalEventOfficialRow {
  id: string;
  event_id: string;
  user_id: string;
  official_role: string;
  notes: string | null;
  status: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface ExternalEventReimbursementRow {
  id: string;
  event_id: string;
  official_user_id: string;
  official_role: string | null;
  title: string;
  description: string | null;
  expense_date: string;
  vendor_name: string | null;
  reference_no: string | null;
  amount: number;
  supporting_document_name: string | null;
  status: string;
  committee_comment: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  reimbursement_case_id: string | null;
  created_at: string;
  updated_at: string;
  data: Record<string, unknown>;
}

export interface ExternalReimbursementHistoryRow {
  id: string;
  external_reimbursement_id: string;
  action: string;
  remarks: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string | null;
  title: string;
  message: string | null;
  related_type: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DocumentRegistryRow {
  id: string;
  title: string;
  category: string;
  event_id: string | null;
  event_name: string | null;
  source_module: string;
  source_record_id: string | null;
  file_name: string;
  file_type: string | null;
  file_size: number;
  storage_bucket: string;
  storage_path: string;
  visibility: string;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
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
      budgets: { Row: BudgetRow; Insert: Partial<BudgetRow>; Update: Partial<BudgetRow> };
      expense_requests: {
        Row: ExpenseRequestRow;
        Insert: Partial<ExpenseRequestRow>;
        Update: Partial<ExpenseRequestRow>;
      };
      expense_lines: { Row: ExpenseLineRow; Insert: Partial<ExpenseLineRow>; Update: Partial<ExpenseLineRow> };
      expense_approvals: {
        Row: ExpenseApprovalRow;
        Insert: Partial<ExpenseApprovalRow>;
        Update: Partial<ExpenseApprovalRow>;
      };
      expense_reversals: {
        Row: ExpenseReversalRow;
        Insert: Partial<ExpenseReversalRow>;
        Update: Partial<ExpenseReversalRow>;
      };
      reimbursement_cases: {
        Row: ReimbursementCaseRow;
        Insert: Partial<ReimbursementCaseRow>;
        Update: Partial<ReimbursementCaseRow>;
      };
      reimbursement_history: {
        Row: ReimbursementHistoryRow;
        Insert: Partial<ReimbursementHistoryRow>;
        Update: Partial<ReimbursementHistoryRow>;
      };
      ap_batches: { Row: ApBatchRow; Insert: Partial<ApBatchRow>; Update: Partial<ApBatchRow> };
      ap_bills: { Row: ApBillRow; Insert: Partial<ApBillRow>; Update: Partial<ApBillRow> };
      vendor_master: { Row: VendorMasterRow; Insert: Partial<VendorMasterRow>; Update: Partial<VendorMasterRow> };
      tournaments: { Row: TournamentRow; Insert: Partial<TournamentRow>; Update: Partial<TournamentRow> };
      tournament_teams: { Row: TournamentTeamRow; Insert: Partial<TournamentTeamRow>; Update: Partial<TournamentTeamRow> };
      tournament_registrations: {
        Row: TournamentRegistrationRow;
        Insert: Partial<TournamentRegistrationRow>;
        Update: Partial<TournamentRegistrationRow>;
      };
      tournament_team_messages: {
        Row: TournamentTeamMessageRow;
        Insert: Partial<TournamentTeamMessageRow>;
        Update: Partial<TournamentTeamMessageRow>;
      };
      tournament_updates: {
        Row: TournamentUpdateRow;
        Insert: Partial<TournamentUpdateRow>;
        Update: Partial<TournamentUpdateRow>;
      };
      tournament_matches: {
        Row: TournamentMatchRow;
        Insert: Partial<TournamentMatchRow>;
        Update: Partial<TournamentMatchRow>;
      };
      tournament_winners: {
        Row: TournamentWinnerRow;
        Insert: Partial<TournamentWinnerRow>;
        Update: Partial<TournamentWinnerRow>;
      };
      staff_location_classification: {
        Row: StaffLocationClassificationRow;
        Insert: Partial<StaffLocationClassificationRow>;
        Update: Partial<StaffLocationClassificationRow>;
      };
      document_registry: {
        Row: DocumentRegistryRow;
        Insert: Partial<DocumentRegistryRow>;
        Update: Partial<DocumentRegistryRow>;
      };
      event_teams: { Row: EventTeamRow; Insert: Partial<EventTeamRow>; Update: Partial<EventTeamRow> };
      event_registrations: {
        Row: EventRegistrationRow;
        Insert: Partial<EventRegistrationRow>;
        Update: Partial<EventRegistrationRow>;
      };
      event_team_messages: {
        Row: EventTeamMessageRow;
        Insert: Partial<EventTeamMessageRow>;
        Update: Partial<EventTeamMessageRow>;
      };
      event_winners: { Row: EventWinnerRow; Insert: Partial<EventWinnerRow>; Update: Partial<EventWinnerRow> };
      external_event_officials: {
        Row: ExternalEventOfficialRow;
        Insert: Partial<ExternalEventOfficialRow>;
        Update: Partial<ExternalEventOfficialRow>;
      };
      external_event_reimbursements: {
        Row: ExternalEventReimbursementRow;
        Insert: Partial<ExternalEventReimbursementRow>;
        Update: Partial<ExternalEventReimbursementRow>;
      };
      external_reimbursement_history: {
        Row: ExternalReimbursementHistoryRow;
        Insert: Partial<ExternalReimbursementHistoryRow>;
        Update: Partial<ExternalReimbursementHistoryRow>;
      };
      notifications: { Row: NotificationRow; Insert: Partial<NotificationRow>; Update: Partial<NotificationRow> };
    };
  };
}
