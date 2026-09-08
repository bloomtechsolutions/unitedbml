import type { ApBatchRow, ApBillRow, ReimbursementCaseRow } from '../../types/database';

export interface GroupItem {
  lineNo: number;
  description: string;
  amount: number;
}

/** A grouped pre-approval covers every reimbursement-flagged line of one Expense Request. */
export interface ProcurementGroupCase extends ReimbursementCaseRow {
  items: GroupItem[];
}

export interface ApBatchWithBills extends ApBatchRow {
  bills: ApBillRow[];
}

export interface EligibleExpenseLine {
  expenseRequestId: string;
  expenseRequestNumber: string | null;
  eventId: string | null;
  eventName: string | null;
  lineNo: number;
  description: string;
  amount: number;
}

export interface EligibleExpenseRequest {
  expenseRequestId: string;
  expenseRequestNumber: string | null;
  title: string | null;
  eventId: string | null;
  eventName: string | null;
  lines: EligibleExpenseLine[];
}

export const CASE_ROUTES = ['Standard', 'Exception'] as const;

export const AP_BATCH_STATUSES = ['Draft', 'Sent to AP', 'Processing', 'Paid', 'Returned / Query', 'Cancelled'] as const;

export const ATTACHMENT_MODES = ['Combined', 'Individual'] as const;
export type AttachmentMode = (typeof ATTACHMENT_MODES)[number];
