import type { ExpenseLineRow, ExpenseRequestRow } from '../../types/database';

export interface ExpenseRequestWithLines extends ExpenseRequestRow {
  lines: ExpenseLineRow[];
}

export const EXPENSE_STATUSES = [
  'Draft',
  'Pending President Recommendation',
  'Pending Final Approval',
  'Approved',
  'Rejected',
  'Cancelled',
  'Reversed',
] as const;

/** Ground truth: guard_expense_approval_transition() in supabase/migrations/020_extended_final_approvers.sql */
export const FINAL_APPROVER_ROLES = [
  'Vice Chairperson',
  'Chairperson',
  'Head of Total Rewards & Employee Relations',
  'Head of Talent Acquisition & People Development',
  'Head of Employee Experience & HR Business Partnering',
] as const;

export interface DraftLine {
  description: string;
  quantity: number;
  rate: number;
  vendor: string;
  reimbursement_required: boolean;
}
