import type { EventRow, EventTaskRow } from '../../types/database';
import type { ExpenseRequestWithLines } from '../finance/types';

export interface TimelineEntry {
  at: string;
  tag: 'Meeting' | 'Event' | 'Task' | 'Finance' | 'Attendance';
  title: string;
  detail?: string;
}

/** Assembles a best-effort chronological activity log for an event from data already on
 * hand (event, its tasks, its linked expense requests) — there's no dedicated audit-log
 * table for this, so a few entries (e.g. the exact moment of a President recommendation)
 * use the closest available timestamp rather than a precisely logged one. */
export function buildEventTimeline(event: EventRow, tasks: EventTaskRow[], financeRequests: ExpenseRequestWithLines[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  if (event.source_meeting_id) {
    entries.push({
      at: event.source_meeting_date ? `${event.source_meeting_date}T00:00:00` : event.created_at,
      tag: 'Meeting',
      title: 'Event initiated from meeting agenda',
      detail: `${event.source_meeting_title ?? 'Meeting'} — ${event.source_agenda_title ?? ''}`,
    });
  }

  entries.push({
    at: event.created_at,
    tag: 'Event',
    title: 'Event created',
    detail: `${event.name} created${event.coordinator ? ` · Coordinator: ${event.coordinator}` : ''}`,
  });

  for (const task of tasks) {
    entries.push({
      at: task.created_at,
      tag: 'Task',
      title: `${task.task_text}: Task created`,
      detail: `${task.owner ? `Assigned to ${task.owner}` : 'Unassigned'}${task.owner_role ? ` — ${task.owner_role}` : ''}${task.due_date ? `; due ${task.due_date}` : ''}`,
    });
  }

  for (const req of financeRequests) {
    entries.push({
      at: req.created_at,
      tag: 'Finance',
      title: `Expense request ${req.request_number ?? req.id} created`,
      detail: `${req.title ?? ''} · MVR ${(req.total_amount ?? 0).toLocaleString()}`,
    });
    if (req.president_recommendation) {
      entries.push({
        at: req.updated_at,
        tag: 'Finance',
        title: 'President recommendation',
        detail: req.president_recommendation,
      });
    }
    if (req.status === 'Approved' && req.approved_at) {
      entries.push({
        at: req.approved_at,
        tag: 'Finance',
        title: 'Expense approved',
        detail: `MVR ${(req.total_amount ?? 0).toLocaleString()} approved${req.approved_by_name ? ` by ${req.approved_by_name}` : ''}`,
      });
    }
    if (req.status === 'Rejected') {
      entries.push({ at: req.updated_at, tag: 'Finance', title: 'Expense rejected', detail: req.final_approver_comment ?? undefined });
    }
  }

  if (event.attendance_count > 0 && event.attendance_updated_at) {
    entries.push({
      at: event.attendance_updated_at,
      tag: 'Attendance',
      title: 'Attendance recorded',
      detail: `${event.attendance_count} attended`,
    });
  }

  if (event.actual_entered_at) {
    entries.push({
      at: event.actual_entered_at,
      tag: 'Finance',
      title: 'Actual expenses recorded',
      detail: `MVR ${(event.actual_expense_total ?? 0).toLocaleString()}`,
    });
  }

  if (event.finance_closed_at) {
    entries.push({ at: event.finance_closed_at, tag: 'Finance', title: 'Finance settlement closed' });
  }

  if (event.cancelled_at) {
    entries.push({ at: event.cancelled_at, tag: 'Event', title: 'Event cancelled', detail: event.archive_reason ?? undefined });
  }

  if (event.archived && event.archived_at) {
    entries.push({ at: event.archived_at, tag: 'Event', title: 'Event archived', detail: event.archive_reason ?? undefined });
  }

  return entries.filter((e) => e.at).sort((a, b) => a.at.localeCompare(b.at));
}
