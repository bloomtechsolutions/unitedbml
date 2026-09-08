export type ColumnType = 'text' | 'number' | 'money' | 'date' | 'status';

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}

export interface ReportRow {
  _date: string | null;
  _eventId: string | null;
  _eventName: string | null;
  _status: string | null;
  [key: string]: unknown;
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: ReportRow[];
}

export type ReportCategory =
  | 'Finance & Budget'
  | 'Reimbursements & AP'
  | 'Events & Attendance'
  | 'Governance & Committee'
  | 'Meetings & Engagement'
  | 'Communication & Audit'
  | 'Executive Reports';

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'expense-register',
    title: 'Expense Request Register',
    description: 'Every expense request with requester, workflow stage, final approver, and amount.',
    category: 'Finance & Budget',
  },
  {
    id: 'approval-status',
    title: 'Expense Approval Status',
    description: 'Current approval stage per request.',
    category: 'Finance & Budget',
  },
  {
    id: 'budget-utilization',
    title: 'Budget Utilization',
    description: 'Annual budget vs. approved spend and utilization %.',
    category: 'Finance & Budget',
  },
  {
    id: 'event-budget-actual',
    title: 'Event Budget vs Actual',
    description: 'Per-event planned budget, approved spend, actual spend, and variance.',
    category: 'Finance & Budget',
  },
  {
    id: 'monthly-expense',
    title: 'Monthly Expense Report',
    description: 'Approved expense totals by calendar month.',
    category: 'Finance & Budget',
  },
  {
    id: 'reimbursement-master',
    title: 'Reimbursement Master Report',
    description: 'Every reimbursement case with approved/submitted/remaining amounts and AP status.',
    category: 'Reimbursements & AP',
  },
  {
    id: 'event-reimbursements',
    title: 'Event-wise Reimbursements',
    description: 'Reimbursement totals rolled up by event.',
    category: 'Reimbursements & AP',
  },
  {
    id: 'ap-register',
    title: 'AP Submission Register',
    description: 'Every AP batch with bill count and total amount.',
    category: 'Reimbursements & AP',
  },
  {
    id: 'vendor-summary',
    title: 'Vendor Expense Summary',
    description: 'Bill totals grouped by vendor across all AP batches.',
    category: 'Reimbursements & AP',
  },
  {
    id: 'events-master',
    title: 'Events Master Report',
    description: 'Master event register — date, type, status, budget, actual, settlement status.',
    category: 'Events & Attendance',
  },
  {
    id: 'attendance-summary',
    title: 'Attendance Summary',
    description: 'Expected vs. attended participants and attendance rate per event.',
    category: 'Events & Attendance',
  },
  {
    id: 'committee-directory',
    title: 'Committee Directory',
    description: 'Committee positions, assigned member, availability, and term dates.',
    category: 'Governance & Committee',
  },
  {
    id: 'pending-actions',
    title: 'Pending Action Points',
    description: 'Open or overdue meeting action items across all meetings.',
    category: 'Meetings & Engagement',
  },
  {
    id: 'email-status',
    title: 'Email Status Report',
    description: 'Final-approval and Procurement email tracking across Finance and Reimbursements.',
    category: 'Communication & Audit',
  },
  {
    id: 'monthly-executive',
    title: 'UnitedBML Monthly Executive Report',
    description: 'Single-month management rollup: events, attendance, expenses, approvals, reimbursements.',
    category: 'Executive Reports',
  },
];

export const REPORT_CATEGORIES: ReportCategory[] = [
  'Finance & Budget',
  'Reimbursements & AP',
  'Events & Attendance',
  'Governance & Committee',
  'Meetings & Engagement',
  'Communication & Audit',
  'Executive Reports',
];

export interface ReportFilters {
  from: string;
  to: string;
  eventId: string;
  status: string;
  search: string;
}

export const EMPTY_FILTERS: ReportFilters = { from: '', to: '', eventId: '', status: '', search: '' };
