import { supabase } from '../../lib/supabase';
import type { ReportColumn, ReportResult, ReportRow } from './types';

async function all<T>(table: string, select = '*'): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(select);
  if (error) throw error;
  return (data ?? []) as T[];
}

const money: ReportColumn['type'] = 'money';
const text: ReportColumn['type'] = 'text';
const num: ReportColumn['type'] = 'number';
const date: ReportColumn['type'] = 'date';
const status: ReportColumn['type'] = 'status';

function col(key: string, label: string, type: ReportColumn['type']): ReportColumn {
  return { key, label, type };
}

// ---------- Finance & Budget ----------

export async function expenseRegister(): Promise<ReportResult> {
  const requests = await all<Record<string, unknown>>('expense_requests');
  return {
    columns: [
      col('request_number', 'Request #', text),
      col('title', 'Title', text),
      col('event_name', 'Event', text),
      col('requested_by', 'Requested By', text),
      col('status', 'Status', status),
      col('final_approver_name', 'Final Approver', text),
      col('total_amount', 'Total', money),
    ],
    rows: requests.map((r) => ({
      ...r,
      _date: (r.request_date as string) ?? null,
      _eventId: (r.event_id as string) ?? null,
      _eventName: (r.event_name as string) ?? null,
      _status: (r.status as string) ?? null,
    })),
  };
}

export async function approvalStatus(): Promise<ReportResult> {
  const requests = await all<Record<string, unknown>>('expense_requests');
  return {
    columns: [
      col('request_number', 'Request #', text),
      col('title', 'Title', text),
      col('status', 'Approval Stage', status),
      col('president_recommendation', 'President', text),
      col('final_approver_name', 'Final Approver', text),
      col('approved_at', 'Approved At', date),
    ],
    rows: requests.map((r) => ({
      ...r,
      _date: (r.request_date as string) ?? null,
      _eventId: (r.event_id as string) ?? null,
      _eventName: (r.event_name as string) ?? null,
      _status: (r.status as string) ?? null,
    })),
  };
}

export async function budgetUtilization(): Promise<ReportResult> {
  const year = new Date().getFullYear();
  const [{ data: budget }, requests] = await Promise.all([
    supabase.from('budgets').select('*').eq('budget_year', year).maybeSingle(),
    all<{ status: string; total_amount: number }>('expense_requests'),
  ]);
  const approved = requests.filter((r) => r.status === 'Approved').reduce((s, r) => s + (r.total_amount || 0), 0);
  const annual = budget?.approved_amount ?? 0;
  const row: ReportRow = {
    _date: null,
    _eventId: null,
    _eventName: null,
    _status: null,
    budget_year: year,
    annual_budget: annual,
    approved_spend: approved,
    available_budget: annual - approved,
    utilization_pct: annual ? Math.round((approved / annual) * 1000) / 10 : 0,
  };
  return {
    columns: [
      col('budget_year', 'Year', text),
      col('annual_budget', 'Annual Budget', money),
      col('approved_spend', 'Approved Spend', money),
      col('available_budget', 'Available', money),
      col('utilization_pct', 'Utilization %', num),
    ],
    rows: [row],
  };
}

export async function eventBudgetActual(): Promise<ReportResult> {
  const events = await all<Record<string, unknown>>('events');
  return {
    columns: [
      col('name', 'Event', text),
      col('event_date', 'Date', date),
      col('planned_budget', 'Planned', money),
      col('actual_expense_total', 'Actual', money),
      col('variance', 'Variance', money),
      col('finance_settlement_status', 'Settlement', status),
    ],
    rows: events.map((e) => ({
      ...e,
      variance: (e.planned_budget as number) - (e.actual_expense_total as number),
      _date: (e.event_date as string) ?? null,
      _eventId: e.id as string,
      _eventName: e.name as string,
      _status: (e.finance_settlement_status as string) ?? null,
    })),
  };
}

export async function monthlyExpense(): Promise<ReportResult> {
  const requests = await all<{ status: string; total_amount: number; request_date: string | null }>('expense_requests');
  const byMonth = new Map<string, number>();
  for (const r of requests) {
    if (r.status !== 'Approved' || !r.request_date) continue;
    const month = r.request_date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + (r.total_amount || 0));
  }
  const rows = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({ _date: `${month}-01`, _eventId: null, _eventName: null, _status: null, month, approved_total: total }));
  return {
    columns: [col('month', 'Month', text), col('approved_total', 'Approved Total', money)],
    rows,
  };
}

// ---------- Reimbursements & AP ----------

export async function reimbursementMaster(): Promise<ReportResult> {
  const [cases, batches, bills] = await Promise.all([
    all<Record<string, unknown>>('reimbursement_cases'),
    all<{ id: string; reimbursement_id: string; status: string }>('ap_batches'),
    all<{ ap_batch_id: string; amount: number }>('ap_bills'),
  ]);
  const lineCases = cases.filter((c) => !(c.data as { isProcurementGroup?: boolean } | null)?.isProcurementGroup);
  const billsByBatch = new Map<string, number>();
  for (const b of bills) billsByBatch.set(b.ap_batch_id, (billsByBatch.get(b.ap_batch_id) ?? 0) + (b.amount || 0));

  return {
    columns: [
      col('case_ref', 'Case Ref', text),
      col('event_name', 'Event', text),
      col('expense_item', 'Item', text),
      col('approved_item_amount', 'Approved', money),
      col('submitted_total', 'Submitted', money),
      col('remaining', 'Remaining', money),
      col('status', 'Status', status),
    ],
    rows: lineCases.map((c) => {
      const submitted = batches
        .filter((b) => b.reimbursement_id === c.id && b.status !== 'Draft' && b.status !== 'Cancelled')
        .reduce((s, b) => s + (billsByBatch.get(b.id) ?? 0), 0);
      const approved = (c.approved_item_amount as number) || 0;
      return {
        ...c,
        submitted_total: submitted,
        remaining: approved - submitted,
        _date: (c.created_at as string) ?? null,
        _eventId: (c.event_id as string) ?? null,
        _eventName: (c.event_name as string) ?? null,
        _status: (c.status as string) ?? null,
      };
    }),
  };
}

export async function eventReimbursements(): Promise<ReportResult> {
  const { rows } = await reimbursementMaster();
  const byEvent = new Map<string, { eventName: string; approved: number; submitted: number; count: number }>();
  for (const r of rows) {
    const key = r._eventId ?? 'none';
    const entry = byEvent.get(key) ?? { eventName: r._eventName ?? 'No event', approved: 0, submitted: 0, count: 0 };
    entry.approved += (r.approved_item_amount as number) || 0;
    entry.submitted += (r.submitted_total as number) || 0;
    entry.count += 1;
    byEvent.set(key, entry);
  }
  return {
    columns: [
      col('event_name', 'Event', text),
      col('cases', 'Cases', num),
      col('approved_total', 'Approved', money),
      col('submitted_total', 'Submitted', money),
    ],
    rows: Array.from(byEvent.entries()).map(([eventId, v]) => ({
      _date: null,
      _eventId: eventId === 'none' ? null : eventId,
      _eventName: v.eventName,
      _status: null,
      event_name: v.eventName,
      cases: v.count,
      approved_total: v.approved,
      submitted_total: v.submitted,
    })),
  };
}

export async function apRegister(): Promise<ReportResult> {
  const [batches, bills, cases] = await Promise.all([
    all<Record<string, unknown>>('ap_batches'),
    all<{ ap_batch_id: string; amount: number }>('ap_bills'),
    all<{ id: string; case_ref: string; event_id: string | null; event_name: string | null }>('reimbursement_cases'),
  ]);
  const caseById = new Map(cases.map((c) => [c.id, c] as const));
  const billsByBatch = new Map<string, { count: number; total: number }>();
  for (const b of bills) {
    const entry = billsByBatch.get(b.ap_batch_id) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += b.amount || 0;
    billsByBatch.set(b.ap_batch_id, entry);
  }
  return {
    columns: [
      col('submission_ref', 'AP Ref', text),
      col('case_ref', 'Case', text),
      col('event_name', 'Event', text),
      col('bill_count', 'Bills', num),
      col('amount', 'Amount', money),
      col('status', 'Status', status),
    ],
    rows: batches.map((b) => {
      const parentCase = caseById.get(b.reimbursement_id as string);
      const billStats = billsByBatch.get(b.id as string) ?? { count: 0, total: 0 };
      return {
        ...b,
        case_ref: parentCase?.case_ref ?? '',
        event_name: parentCase?.event_name ?? '',
        bill_count: billStats.count,
        amount: billStats.total,
        _date: (b.submission_date as string) ?? null,
        _eventId: parentCase?.event_id ?? null,
        _eventName: parentCase?.event_name ?? null,
        _status: (b.status as string) ?? null,
      };
    }),
  };
}

export async function vendorSummary(): Promise<ReportResult> {
  const bills = await all<{ vendor_number: string | null; vendor_name: string | null; amount: number }>('ap_bills');
  const byVendor = new Map<string, { name: string; total: number; count: number }>();
  for (const b of bills) {
    const key = b.vendor_number || b.vendor_name || 'Unknown';
    const entry = byVendor.get(key) ?? { name: b.vendor_name || key, total: 0, count: 0 };
    entry.total += b.amount || 0;
    entry.count += 1;
    byVendor.set(key, entry);
  }
  return {
    columns: [
      col('vendor_account', 'Vendor Account', text),
      col('vendor_name', 'Vendor Name', text),
      col('bill_count', 'Bills', num),
      col('total_amount', 'Total', money),
    ],
    rows: Array.from(byVendor.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([account, v]) => ({
        _date: null,
        _eventId: null,
        _eventName: null,
        _status: null,
        vendor_account: account,
        vendor_name: v.name,
        bill_count: v.count,
        total_amount: v.total,
      })),
  };
}

// ---------- Events & Attendance ----------

export async function eventsMaster(): Promise<ReportResult> {
  const events = await all<Record<string, unknown>>('events');
  return {
    columns: [
      col('name', 'Event', text),
      col('event_type', 'Type', text),
      col('event_date', 'Date', date),
      col('status', 'Status', status),
      col('planned_budget', 'Planned Budget', money),
      col('actual_expense_total', 'Actual', money),
      col('finance_settlement_status', 'Settlement', text),
      col('expected_participants', 'Expected', num),
    ],
    rows: events.map((e) => ({
      ...e,
      _date: (e.event_date as string) ?? null,
      _eventId: e.id as string,
      _eventName: e.name as string,
      _status: (e.status as string) ?? null,
    })),
  };
}

export async function attendanceSummary(): Promise<ReportResult> {
  const [events, attendance] = await Promise.all([
    all<{ id: string; name: string; event_date: string | null; expected_participants: number }>('events'),
    all<{ event_id: string; attended: boolean }>('event_attendance'),
  ]);
  return {
    columns: [
      col('name', 'Event', text),
      col('expected', 'Expected', num),
      col('recorded', 'Recorded', num),
      col('attended', 'Attended', num),
      col('rate_pct', 'Attendance %', num),
    ],
    rows: events.map((e) => {
      const roster = attendance.filter((a) => a.event_id === e.id);
      const attended = roster.filter((a) => a.attended).length;
      return {
        _date: e.event_date,
        _eventId: e.id,
        _eventName: e.name,
        _status: null,
        name: e.name,
        expected: e.expected_participants,
        recorded: roster.length,
        attended,
        rate_pct: roster.length ? Math.round((attended / roster.length) * 1000) / 10 : 0,
      };
    }),
  };
}

// ---------- Governance & Committee ----------

export async function committeeDirectory(): Promise<ReportResult> {
  const members = await all<Record<string, unknown>>('committee_members');
  return {
    columns: [
      col('role', 'Position', text),
      col('name', 'Member', text),
      col('status', 'Status', status),
      col('availability', 'Availability', status),
      col('term_start', 'Term Start', date),
      col('term_end', 'Term End', date),
    ],
    rows: members.map((m) => ({
      ...m,
      _date: null,
      _eventId: null,
      _eventName: null,
      _status: (m.status as string) ?? null,
    })),
  };
}

// ---------- Meetings & Engagement ----------

export async function pendingActions(): Promise<ReportResult> {
  const [actions, meetings] = await Promise.all([
    all<Record<string, unknown>>('meeting_actions'),
    all<{ id: string; title: string }>('meetings'),
  ]);
  const meetingById = new Map(meetings.map((m) => [m.id, m] as const));
  const open = actions.filter((a) => a.status !== 'Completed');
  return {
    columns: [
      col('action_text', 'Action', text),
      col('meeting_title', 'Meeting', text),
      col('assigned_to', 'Assigned To', text),
      col('due_date', 'Due', date),
      col('status', 'Status', status),
    ],
    rows: open.map((a) => ({
      ...a,
      meeting_title: meetingById.get(a.meeting_id as string)?.title ?? '',
      _date: (a.due_date as string) ?? null,
      _eventId: null,
      _eventName: null,
      _status: (a.status as string) ?? null,
    })),
  };
}

// ---------- Communication & Audit ----------

export async function emailStatus(): Promise<ReportResult> {
  const groups = await all<Record<string, unknown>>('reimbursement_cases');
  const procurementRows = groups
    .filter((c) => (c.data as { isProcurementGroup?: boolean } | null)?.isProcurementGroup)
    .map((c) => ({
      ...c,
      channel: 'Procurement',
      recipient: c.procurement_manager_email,
      sent_at: c.email_sent_at,
      _date: (c.email_sent_at as string) ?? (c.created_at as string) ?? null,
      _eventId: (c.event_id as string) ?? null,
      _eventName: (c.event_name as string) ?? null,
      _status: (c.status as string) ?? null,
    }));
  return {
    columns: [
      col('channel', 'Channel', text),
      col('case_ref', 'Reference', text),
      col('recipient', 'Recipient', text),
      col('status', 'Status', status),
      col('sent_at', 'Sent At', date),
    ],
    rows: procurementRows,
  };
}

// ---------- Executive Reports ----------

export async function monthlyExecutive(month: string): Promise<ReportResult> {
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const [events, attendance, requests, cases, batches] = await Promise.all([
    all<{ id: string; event_date: string | null; expected_participants: number; actual_expense_total: number }>('events'),
    all<{ event_id: string; attended: boolean }>('event_attendance'),
    all<{ status: string; total_amount: number; request_date: string | null }>('expense_requests'),
    all<{ status: string; created_at: string }>('reimbursement_cases'),
    all<{ status: string; reimbursement_id: string }>('ap_batches'),
  ]);
  const monthEvents = events.filter((e) => (e.event_date ?? '').startsWith(targetMonth));
  const monthEventIds = new Set(monthEvents.map((e) => e.id));
  const monthAttendance = attendance.filter((a) => monthEventIds.has(a.event_id));
  const monthRequests = requests.filter((r) => (r.request_date ?? '').startsWith(targetMonth));
  const monthCases = cases.filter((c) => (c.created_at ?? '').startsWith(targetMonth));

  const row: ReportRow = {
    _date: `${targetMonth}-01`,
    _eventId: null,
    _eventName: null,
    _status: null,
    month: targetMonth,
    events: monthEvents.length,
    expected_participants: monthEvents.reduce((s, e) => s + (e.expected_participants || 0), 0),
    attended: monthAttendance.filter((a) => a.attended).length,
    approved_expense: monthRequests.filter((r) => r.status === 'Approved').reduce((s, r) => s + (r.total_amount || 0), 0),
    actual_expense: monthEvents.reduce((s, e) => s + (e.actual_expense_total || 0), 0),
    pending_approvals: monthRequests.filter((r) => r.status.startsWith('Pending')).length,
    open_reimbursements: monthCases.filter((c) => c.status !== 'Approved' && c.status !== 'Rejected').length,
    ap_batches_active: batches.filter((b) => b.status !== 'Draft' && b.status !== 'Cancelled').length,
  };

  return {
    columns: [
      col('month', 'Month', text),
      col('events', 'Events', num),
      col('expected_participants', 'Expected', num),
      col('attended', 'Attended', num),
      col('approved_expense', 'Approved Expense', money),
      col('actual_expense', 'Actual Expense', money),
      col('pending_approvals', 'Pending Approvals', num),
      col('open_reimbursements', 'Open Reimbursements', num),
    ],
    rows: [row],
  };
}

export async function runReport(id: string, month: string): Promise<ReportResult> {
  switch (id) {
    case 'expense-register':
      return expenseRegister();
    case 'approval-status':
      return approvalStatus();
    case 'budget-utilization':
      return budgetUtilization();
    case 'event-budget-actual':
      return eventBudgetActual();
    case 'monthly-expense':
      return monthlyExpense();
    case 'reimbursement-master':
      return reimbursementMaster();
    case 'event-reimbursements':
      return eventReimbursements();
    case 'ap-register':
      return apRegister();
    case 'vendor-summary':
      return vendorSummary();
    case 'events-master':
      return eventsMaster();
    case 'attendance-summary':
      return attendanceSummary();
    case 'committee-directory':
      return committeeDirectory();
    case 'pending-actions':
      return pendingActions();
    case 'email-status':
      return emailStatus();
    case 'monthly-executive':
      return monthlyExecutive(month);
    default:
      return { columns: [], rows: [] };
  }
}
