import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  EventRow,
  MeetingActionHistoryRow,
  MeetingActionRow,
  MeetingAgendaRow,
  MeetingAttendeeRow,
  MeetingDecisionRow,
  MeetingRow,
} from '../../types/database';
import type { CommitteeMemberOption } from '../events/types';
import type { MeetingWithChildren } from './types';

function assemble(
  meetings: MeetingRow[],
  attendees: MeetingAttendeeRow[],
  agenda: MeetingAgendaRow[],
  decisions: MeetingDecisionRow[],
  actions: MeetingActionRow[]
): MeetingWithChildren[] {
  return meetings.map((meeting) => ({
    ...meeting,
    attendees: attendees.filter((a) => a.meeting_id === meeting.id),
    agenda: agenda.filter((a) => a.meeting_id === meeting.id).sort((a, b) => a.sort_order - b.sort_order),
    decisions: decisions.filter((d) => d.meeting_id === meeting.id),
    actions: actions.filter((a) => a.meeting_id === meeting.id),
  }));
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<MeetingWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [meetingsRes, attendeesRes, agendaRes, decisionsRes, actionsRes] = await Promise.all([
      supabase.from('meetings').select('*').order('meeting_date', { ascending: false }),
      supabase.from('meeting_attendees').select('*'),
      supabase.from('meeting_agenda').select('*'),
      supabase.from('meeting_decisions').select('*'),
      supabase.from('meeting_actions').select('*'),
    ]);
    const firstError =
      meetingsRes.error || attendeesRes.error || agendaRes.error || decisionsRes.error || actionsRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setMeetings(
      assemble(
        meetingsRes.data ?? [],
        attendeesRes.data ?? [],
        agendaRes.data ?? [],
        decisionsRes.data ?? [],
        actionsRes.data ?? []
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { meetings, loading, error, reload };
}

export async function createMeeting(payload: Partial<MeetingRow>, committeeMembers: CommitteeMemberOption[]) {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('meetings').insert({ ...payload, id });
  if (error) throw error;
  await seedAttendance(id, committeeMembers, []);
  return id;
}

export async function updateMeeting(id: string, payload: Partial<MeetingRow>) {
  const { error } = await supabase.from('meetings').update(payload).eq('id', id);
  if (error) throw error;
}

export async function cancelMeeting(id: string) {
  const { error } = await supabase
    .from('meetings')
    .update({ cancelled: true, cancelled_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function toggleMinutesFinalized(id: string, finalized: boolean) {
  const { error } = await supabase
    .from('meetings')
    .update({ minutes_finalized: finalized, minutes_finalized_at: finalized ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

/** Mirrors ensureMeetingAttendance(): appends an 'Expected' row for any active committee member not yet seated. */
export async function seedAttendance(
  meetingId: string,
  committeeMembers: CommitteeMemberOption[],
  existing: MeetingAttendeeRow[]
) {
  const existingKeys = new Set(existing.map((a) => a.source_key));
  const rows = committeeMembers
    .filter((m) => !existingKeys.has(m.id))
    .map((m) => ({
      meeting_id: meetingId,
      source_key: m.id,
      committee_id: m.id,
      attendee_name: m.name ?? '',
      attendee_role: m.role,
      attendance_status: 'Expected',
    }));
  if (!rows.length) return;
  const { error } = await supabase.from('meeting_attendees').upsert(rows, { onConflict: 'meeting_id,source_key' });
  if (error) throw error;
}

export async function updateAttendeeStatus(attendeeId: string, status: string) {
  const { error } = await supabase
    .from('meeting_attendees')
    .update({ attendance_status: status })
    .eq('id', attendeeId);
  if (error) throw error;
}

export async function saveAgendaItem(payload: Partial<MeetingAgendaRow> & { meeting_id: string }) {
  const id = payload.id ?? crypto.randomUUID();
  const sourceKey = payload.source_key ?? id;
  const { error } = await supabase.from('meeting_agenda').upsert({ ...payload, id, source_key: sourceKey });
  if (error) throw error;
  return id;
}

export async function deleteAgendaItem(id: string) {
  const { error } = await supabase.from('meeting_agenda').delete().eq('id', id);
  if (error) throw error;
}

export async function saveDecision(payload: Partial<MeetingDecisionRow> & { meeting_id: string }) {
  const id = payload.id ?? crypto.randomUUID();
  const sourceKey = payload.source_key ?? id;
  const { error } = await supabase.from('meeting_decisions').upsert({ ...payload, id, source_key: sourceKey });
  if (error) throw error;
  return id;
}

export async function deleteDecision(id: string) {
  const { error } = await supabase.from('meeting_decisions').delete().eq('id', id);
  if (error) throw error;
}

export async function saveAction(
  payload: Partial<MeetingActionRow> & { meeting_id: string },
  meeting: Pick<MeetingRow, 'id' | 'title'>
) {
  const id = payload.id ?? crypto.randomUUID();
  const sourceKey = payload.source_key ?? id;
  const isNew = !payload.id;
  const { error } = await supabase.from('meeting_actions').upsert({ ...payload, id, source_key: sourceKey });
  if (error) throw error;

  // Mirrors legacy one-way sync: a meeting action linked to an Event gets a shadow Event task.
  if (payload.event_id) {
    if (isNew) {
      const { error: taskError } = await supabase.from('event_tasks').insert({
        event_id: payload.event_id,
        source_key: `meeting-action-${id}`,
        task_text: payload.action_text ?? '',
        owner: payload.assigned_to ?? null,
        owner_role: payload.assigned_role ?? null,
        due_date: payload.due_date ?? null,
        priority: payload.priority ?? null,
        status: payload.status ?? 'Open',
        done: payload.status === 'Completed',
        source_meeting_id: meeting.id,
        source_meeting_action_id: id,
        source_meeting_action_status: payload.status ?? 'Open',
      });
      if (taskError) throw taskError;
    } else {
      await syncLinkedEventTaskFromMeeting(id, payload);
    }
  }
  return id;
}

async function syncLinkedEventTaskFromMeeting(actionId: string, payload: Partial<MeetingActionRow>) {
  const { error } = await supabase
    .from('event_tasks')
    .update({
      task_text: payload.action_text,
      owner: payload.assigned_to ?? null,
      owner_role: payload.assigned_role ?? null,
      due_date: payload.due_date ?? null,
      priority: payload.priority ?? null,
      status: payload.status,
      done: payload.status === 'Completed',
      source_meeting_action_status: payload.status,
    })
    .eq('source_meeting_action_id', actionId);
  if (error) throw error;
}

export async function recordActionHistory(entry: Partial<MeetingActionHistoryRow> & { meeting_action_id: string }) {
  const { error } = await supabase.from('meeting_action_history').insert(entry);
  if (error) throw error;
}

export async function deleteAction(id: string) {
  const { error } = await supabase.from('meeting_actions').delete().eq('id', id);
  if (error) throw error;
}

export async function createEventFromAgendaItem(
  meeting: Pick<MeetingRow, 'id' | 'title' | 'meeting_date'>,
  agenda: MeetingAgendaRow
) {
  const eventId = String(Date.now());
  const { error: eventError } = await supabase.from('events').insert({
    id: eventId,
    name: agenda.title,
    description: agenda.details || agenda.discussion || null,
    coordinator: agenda.owner || null,
    status: 'Planning',
    source_meeting_id: meeting.id,
    source_meeting_title: meeting.title,
    source_meeting_date: meeting.meeting_date,
    source_agenda_id: agenda.id,
    source_agenda_title: agenda.title,
    source_agenda_outcome: agenda.outcome,
  } satisfies Partial<EventRow>);
  if (eventError) throw eventError;

  const { error: agendaError } = await supabase
    .from('meeting_agenda')
    .update({ created_event_id: eventId, event_id: eventId })
    .eq('id', agenda.id);
  if (agendaError) throw agendaError;

  return eventId;
}

export function pendingEventCreationAgenda(meetings: MeetingWithChildren[]) {
  return meetings.flatMap((m) =>
    m.agenda
      .filter((a) => a.outcome === 'Create Event / Activity' && !a.created_event_id)
      .map((a) => ({ meeting: m, agenda: a }))
  );
}

export function openActionsAcrossMeetings(meetings: MeetingWithChildren[], excludeMeetingId?: string) {
  return meetings
    .filter((m) => m.id !== excludeMeetingId)
    .flatMap((m) => m.actions.filter((a) => a.status !== 'Completed').map((a) => ({ meeting: m, action: a })));
}

export async function applyCarryForward(
  meetingId: string,
  actions: MeetingActionRow[],
  meetings: MeetingWithChildren[]
) {
  let order = 0;
  for (const action of actions) {
    const sourceMeeting = meetings.find((m) => m.actions.some((a) => a.id === action.id));
    await saveAgendaItem({
      meeting_id: meetingId,
      title: `Follow-up: ${action.action_text}`,
      owner: action.assigned_to,
      outcome: null,
      details: action.remarks,
      carry_forward: true,
      source_meeting_id: sourceMeeting?.id ?? null,
      source_meeting_title: sourceMeeting?.title ?? null,
      source_action_id: action.id,
      source_action_text: action.action_text,
      sort_order: order++,
    });
  }
}
