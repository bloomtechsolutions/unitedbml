export const SETTLEMENT_STATUSES = ['Pending Actuals', 'Actuals Entered', 'Closed'] as const;

export const CONTINGENCY_STATUSES = [
  'Pending President Recommendation',
  'Pending Procurement Pre-Approval',
  'Awaiting Procurement Response',
  'Approved',
  'Rejected',
] as const;

export const CONTINGENCY_ACTIVE_STATUSES: readonly string[] = [
  'Pending President Recommendation',
  'Pending Procurement Pre-Approval',
  'Awaiting Procurement Response',
];

export interface SettlementRow {
  key: string;
  isGeneral: boolean;
  reference: string;
  title: string;
  eventId: string | null;
  eventName: string | null;
  requestIds: string[];
  date: string | null;
  approved: number;
  actual: number;
  status: string;
  contingencyReleased: number;
  pendingContingency: number;
  reimbursementPendingCount: number;
}

export type ReconciliationSourceType = 'Direct Entry' | 'Reimbursement' | 'Reserve';

export interface ReconciliationLine {
  sourceKey: string;
  expenseRequestId: string;
  expenseRequestNumber: string | null;
  lineIndex: number;
  expenseItem: string;
  originalApprovedAmount: number;
  contingencyAdded: number;
  approvedAmount: number;
  reimbursementRequired: boolean;
  isContingency: boolean;
  sourceType: ReconciliationSourceType;
  actualAmount: number;
  manualEntered: boolean;
  settled: boolean;
  reimbursementDetail?: string;
}
