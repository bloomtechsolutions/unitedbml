import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  EventAttendanceRow,
  EventRegistrationRow,
  EventRow,
  EventTeamMessageRow,
  EventTeamRow,
  EventWinnerRow,
  ExternalEventOfficialRow,
  ExternalEventReimbursementRow,
} from '../../types/database';
import type { MyEngagement, OfficialAssignment, PortalEvent } from './types';

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  member_uid: string | null;
  contact_no: string | null;
};

function assemble(events: EventRow[], teams: EventTeamRow[], regs: EventRegistrationRow[], winners: EventWinnerRow[], userId: string | undefined): PortalEvent[] {
  return events.map((e) => ({
    ...e,
    teams: teams.filter((t) => t.event_id === e.id),
    registrations: regs.filter((r) => r.event_id === e.id),
    winners: winners.filter((w) => w.event_id === e.id),
    myRegistration: regs.find((r) => r.event_id === e.id && r.user_id === userId) ?? null,
  }));
}

export function usePortalEvents(userId: string | undefined) {
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [eventsRes, teamsRes, regsRes, winnersRes] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('event_teams').select('*'),
      supabase.from('event_registrations').select('*'),
      supabase.from('event_winners').select('*'),
    ]);
    const firstError = eventsRes.error || teamsRes.error || regsRes.error || winnersRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setEvents(assemble(eventsRes.data ?? [], teamsRes.data ?? [], regsRes.data ?? [], winnersRes.data ?? [], userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, loading, error, reload };
}

async function resolveDepartment(profile: Profile): Promise<string | null> {
  const { data } = await supabase.rpc('staff_department_for_user', { p_user_id: profile.id });
  return (data as string) || null;
}

export async function selfRegisterEvent(eventId: string, registrationType: 'Individual' | 'Team' = 'Individual') {
  const { error } = await supabase.rpc('self_register_event', {
    p_event_id: eventId,
    p_registration_type: registrationType,
  });
  if (error) throw error;
}

export async function createEventTeam(eventId: string, teamName: string) {
  const { data, error } = await supabase.rpc('create_event_team', { p_event_id: eventId, p_team_name: teamName });
  if (error) throw error;
  return (data as { team_id: string }).team_id;
}

export async function requestJoinEventTeam(teamId: string) {
  const { error } = await supabase.rpc('request_join_event_team', { p_team_id: teamId });
  if (error) throw error;
}

export async function decideEventTeamJoin(registrationId: string, approve: boolean, comment?: string) {
  const { data, error } = await supabase.rpc('approve_event_team_join', {
    p_registration_id: registrationId,
    p_approve: approve,
    p_comment: comment || null,
  });
  if (error) throw error;
  return data as { ok: boolean; status: string };
}

export async function sendEventTeamMessage(payload: { event_id: string; team_id: string; user_id: string; sender_name: string; message: string }) {
  const { error } = await supabase.from('event_team_messages').insert(payload);
  if (error) throw error;
}

export function useEventTeamMessages(teamId: string | null) {
  const [messages, setMessages] = useState<EventTeamMessageRow[]>([]);

  const reload = useCallback(async () => {
    if (!teamId) {
      setMessages([]);
      return;
    }
    const { data } = await supabase.from('event_team_messages').select('*').eq('team_id', teamId).order('created_at', { ascending: true });
    setMessages(data ?? []);
  }, [teamId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { messages, reload };
}

// Committee-only: registration configuration lives on the events table itself.
export async function updateEventRegistrationSettings(
  eventId: string,
  payload: Partial<
    Pick<
      EventRow,
      | 'registration_enabled'
      | 'registration_mode'
      | 'registration_open_at'
      | 'registration_close_at'
      | 'participant_rules'
      | 'participant_capacity'
      | 'team_size'
      | 'participant_visibility'
    >
  >
) {
  const { error } = await supabase.from('events').update(payload).eq('id', eventId);
  if (error) throw error;
}

export async function assignExternalOfficial(eventId: string, userId: string, role: string, assignedBy: string) {
  const { error } = await supabase
    .from('external_event_officials')
    .upsert(
      { event_id: eventId, user_id: userId, official_role: role, status: 'Active', assigned_by: assignedBy },
      { onConflict: 'event_id,user_id' }
    );
  if (error) throw error;
}

export async function saveEventWinner(payload: Partial<EventWinnerRow> & { event_id: string }) {
  const { error } = await supabase.from('event_winners').insert(payload);
  if (error) throw error;
}

export function useMyOfficialAssignments(userId: string | undefined) {
  const [assignments, setAssignments] = useState<OfficialAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setAssignments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows } = await supabase
      .from('external_event_officials')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'Active');
    const officials = (rows ?? []) as ExternalEventOfficialRow[];
    if (!officials.length) {
      setAssignments([]);
      setLoading(false);
      return;
    }
    const { data: events } = await supabase.from('events').select('id,name').in('id', officials.map((o) => o.event_id));
    const names = new Map((events ?? []).map((e) => [e.id, e.name] as const));
    setAssignments(officials.map((o) => ({ ...o, eventName: names.get(o.event_id) ?? o.event_id })));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { assignments, loading, reload };
}

export function useMyExternalReimbursements(userId: string | undefined) {
  const [items, setItems] = useState<ExternalEventReimbursementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('external_event_reimbursements')
      .select('*')
      .eq('official_user_id', userId)
      .order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, reload };
}

export async function submitExternalReimbursement(payload: {
  eventId: string;
  title: string;
  description: string;
  expenseDate: string;
  vendorName: string;
  referenceNo: string;
  amount: number;
  supportingDocumentName: string;
}) {
  const { error } = await supabase.rpc('submit_external_event_reimbursement', {
    p_event_id: payload.eventId,
    p_title: payload.title,
    p_description: payload.description || null,
    p_expense_date: payload.expenseDate,
    p_vendor_name: payload.vendorName || null,
    p_reference_no: payload.referenceNo || null,
    p_amount: payload.amount,
    p_supporting_document_name: payload.supportingDocumentName || null,
  });
  if (error) throw error;
}

export function usePendingExternalReimbursements() {
  const [items, setItems] = useState<ExternalEventReimbursementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('external_event_reimbursements')
      .select('*')
      .eq('status', 'Pending Committee Approval')
      .order('created_at', { ascending: true });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, reload };
}

export async function decideExternalReimbursement(id: string, approve: boolean, comment?: string) {
  const { data, error } = await supabase.rpc('decide_external_event_reimbursement', {
    p_id: id,
    p_approve: approve,
    p_comment: comment || null,
  });
  if (error) throw error;
  return data as { ok: boolean; status: string };
}

export function computeEngagement(
  profile: Profile | null,
  events: PortalEvent[],
  attendance: EventAttendanceRow[]
): MyEngagement {
  if (!profile) return { registrations: 0, attendances: 0, achievements: 0, points: 0, level: 'Starter' };

  const registrations = events.filter((e) => e.myRegistration && e.myRegistration.status === 'Approved').length;
  const attendances = attendance.filter((a) => a.attended && a.staff_uid && a.staff_uid === profile.member_uid).length;
  const achievements = events.reduce(
    (sum, e) => sum + e.winners.filter((w) => w.staff_uid && w.staff_uid === profile.member_uid).length,
    0
  );

  const points = registrations * 3 + attendances * 5 + achievements * 5;
  const level: MyEngagement['level'] = points >= 75 ? 'Gold' : points >= 40 ? 'Silver' : points >= 15 ? 'Bronze' : 'Starter';

  return { registrations, attendances, achievements, points, level };
}

export function useEventAttendanceAll() {
  const [attendance, setAttendance] = useState<EventAttendanceRow[]>([]);

  useEffect(() => {
    supabase
      .from('event_attendance')
      .select('*')
      .then(({ data }) => setAttendance(data ?? []));
  }, []);

  return attendance;
}

export { resolveDepartment };
