import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  TournamentMatchRow,
  TournamentRegistrationRow,
  TournamentRow,
  TournamentTeamMessageRow,
  TournamentTeamRow,
  TournamentUpdateRow,
  TournamentWinnerRow,
} from '../../types/database';
import type { TournamentWithChildren } from './types';

interface EventSummary {
  name: string;
  event_date: string | null;
  cancelled: boolean;
}

function assemble(
  tournaments: TournamentRow[],
  events: Map<string, EventSummary>,
  teams: TournamentTeamRow[],
  registrations: TournamentRegistrationRow[],
  updates: TournamentUpdateRow[],
  matches: TournamentMatchRow[],
  winners: TournamentWinnerRow[]
): TournamentWithChildren[] {
  return tournaments.map((t) => {
    const event = events.get(t.event_id);
    return {
      ...t,
      eventName: event?.name ?? t.name,
      eventDate: event?.event_date ?? null,
      eventCancelled: event?.cancelled ?? false,
      teams: teams.filter((x) => x.tournament_id === t.id),
      registrations: registrations.filter((x) => x.tournament_id === t.id),
      updates: updates.filter((x) => x.tournament_id === t.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      matches: matches
        .filter((x) => x.tournament_id === t.id)
        .sort((a, b) => (a.match_date ?? '').localeCompare(b.match_date ?? '') || (a.match_time ?? '').localeCompare(b.match_time ?? '')),
      winners: winners.filter((x) => x.tournament_id === t.id),
    };
  });
}

export function useTournaments() {
  const [tournaments, setTournaments] = useState<TournamentWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [tRes, eRes, teamsRes, regsRes, updatesRes, matchesRes, winnersRes] = await Promise.all([
      supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('id,name,event_date,cancelled_at,manual_state,status'),
      supabase.from('tournament_teams').select('*'),
      supabase.from('tournament_registrations').select('*'),
      supabase.from('tournament_updates').select('*'),
      supabase.from('tournament_matches').select('*'),
      supabase.from('tournament_winners').select('*'),
    ]);
    const firstError =
      tRes.error || eRes.error || teamsRes.error || regsRes.error || updatesRes.error || matchesRes.error || winnersRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    const events = new Map(
      (eRes.data ?? []).map(
        (e) =>
          [
            e.id,
            {
              name: e.name,
              event_date: e.event_date,
              cancelled: !!e.cancelled_at || e.manual_state === 'Cancelled' || e.status === 'Cancelled',
            },
          ] as const
      )
    );
    setTournaments(
      assemble(
        tRes.data ?? [],
        events,
        teamsRes.data ?? [],
        regsRes.data ?? [],
        updatesRes.data ?? [],
        matchesRes.data ?? [],
        winnersRes.data ?? []
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { tournaments, loading, error, reload };
}

export async function resolveMyDepartment(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('staff_department_for_user', { p_user_id: userId });
  if (error) return null;
  return (data as string) || null;
}

export async function saveTournamentSetup(id: string, payload: Partial<TournamentRow>) {
  const { error } = await supabase.from('tournaments').update(payload).eq('id', id);
  if (error) throw error;
}

export async function postUpdate(payload: Partial<TournamentUpdateRow> & { tournament_id: string }) {
  const { error } = await supabase.from('tournament_updates').insert(payload);
  if (error) throw error;
}

export async function selfRegisterIndividual(
  tournamentId: string,
  profile: { id: string; full_name: string; email: string | null; member_uid: string | null; contact_no: string | null },
  department: string | null
) {
  const { error } = await supabase.from('tournament_registrations').insert({
    tournament_id: tournamentId,
    user_id: profile.id,
    staff_uid: profile.member_uid,
    staff_name: profile.full_name,
    email: profile.email,
    contact_no: profile.contact_no,
    department,
    registration_type: 'Individual',
    status: 'Approved',
  } satisfies Partial<TournamentRegistrationRow>);
  if (error) throw error;
}

/**
 * Team creation is done via direct inserts rather than the create_tournament_team() RPC: the RLS
 * insert policies on tournament_teams/tournament_registrations already allow a user to create
 * their own team + leader registration, and migration 033 left that RPC in a broken state (a
 * `create or replace function` that changes its return type from migration 027a's `jsonb` without
 * a preceding `drop function`, which Postgres rejects) — see README for details.
 */
export async function createTeam(
  tournamentId: string,
  teamName: string,
  profile: { id: string; full_name: string; email: string | null; member_uid: string | null; contact_no: string | null },
  department: string | null
) {
  const teamId = `TEAM-${crypto.randomUUID().replace(/-/g, '')}`;
  const joinCode = `${teamName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TEA'}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { error: teamError } = await supabase.from('tournament_teams').insert({
    id: teamId,
    tournament_id: tournamentId,
    team_name: teamName.trim(),
    join_code: joinCode,
    leader_user_id: profile.id,
    leader_uid: profile.member_uid,
    leader_name: profile.full_name,
    leader_email: profile.email,
    status: 'Open',
  } satisfies Partial<TournamentTeamRow>);
  if (teamError) throw teamError;

  const { error: regError } = await supabase.from('tournament_registrations').insert({
    tournament_id: tournamentId,
    user_id: profile.id,
    staff_uid: profile.member_uid,
    staff_name: profile.full_name,
    email: profile.email,
    contact_no: profile.contact_no,
    department,
    registration_type: 'Team',
    team_id: teamId,
    status: 'Approved',
  } satisfies Partial<TournamentRegistrationRow>);
  if (regError) throw regError;

  return teamId;
}

export async function requestJoinTeam(
  tournamentId: string,
  teamId: string,
  profile: { id: string; full_name: string; email: string | null; member_uid: string | null; contact_no: string | null },
  department: string | null
) {
  const { error } = await supabase.from('tournament_registrations').insert({
    tournament_id: tournamentId,
    user_id: profile.id,
    staff_uid: profile.member_uid,
    staff_name: profile.full_name,
    email: profile.email,
    contact_no: profile.contact_no,
    department,
    registration_type: 'Team',
    team_id: teamId,
    status: 'Pending Leader Approval',
  } satisfies Partial<TournamentRegistrationRow>);
  if (error) throw error;
}

export async function decideJoinRequest(registrationId: string, decision: 'approve' | 'reject') {
  const { data, error } = await supabase.rpc('approve_tournament_team_request', {
    p_registration_id: registrationId,
    p_decision: decision,
  });
  if (error) throw error;
  return data as { ok: boolean; status: string };
}

export async function removeTeamMember(registrationId: string, reason: string) {
  const { data, error } = await supabase.rpc('remove_tournament_team_member', {
    p_registration_id: registrationId,
    p_reason: reason || null,
  });
  if (error) throw error;
  return data as { ok: boolean; status: string };
}

export async function sendTeamMessage(payload: Partial<TournamentTeamMessageRow> & { tournament_id: string; team_id: string }) {
  const { error } = await supabase.from('tournament_team_messages').insert(payload);
  if (error) throw error;
}

export function useTeamMessages(teamId: string | null) {
  const [messages, setMessages] = useState<TournamentTeamMessageRow[]>([]);

  const reload = useCallback(async () => {
    if (!teamId) {
      setMessages([]);
      return;
    }
    const { data } = await supabase
      .from('tournament_team_messages')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
  }, [teamId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { messages, reload };
}

export async function saveMatch(payload: Partial<TournamentMatchRow> & { tournament_id: string }) {
  const id = payload.id ?? crypto.randomUUID();
  const { error } = await supabase.from('tournament_matches').upsert({ ...payload, id });
  if (error) throw error;
}

export async function deleteMatch(id: string) {
  const { error } = await supabase.from('tournament_matches').delete().eq('id', id);
  if (error) throw error;
}

export async function saveWinner(payload: Partial<TournamentWinnerRow> & { tournament_id: string }) {
  const { error } = await supabase
    .from('tournament_winners')
    .upsert(payload, { onConflict: 'tournament_id,position' });
  if (error) throw error;
}

export async function deleteWinner(id: string) {
  const { error } = await supabase.from('tournament_winners').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchPublicStats(tournamentId: string) {
  const { data, error } = await supabase.rpc('get_tournament_public_stats', { p_tournament_id: tournamentId });
  if (error) throw error;
  return data as {
    registrations: number;
    pending: number;
    teams: number;
    teamCounts: { teamId: string; count: number }[];
    completedMatches: number;
    departments: { department: string; count: number }[];
  };
}

export interface LinkedTournament {
  id: string;
  tournament_mode: string;
}

/** Whether an Event has a Tournament attached — used by the Events/Attendance tab to switch
 * from plain manual roster entry to Sync Registrations + Add Walk-in (V13.17). */
export function useLinkedTournament(eventId: string) {
  const [tournament, setTournament] = useState<LinkedTournament | null>(null);

  const reload = useCallback(async () => {
    if (!eventId) {
      setTournament(null);
      return;
    }
    const { data } = await supabase.from('tournaments').select('id,tournament_mode').eq('event_id', eventId).maybeSingle();
    setTournament(data ?? null);
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return tournament;
}

/**
 * Syncs approved Tournament registrations (flattened from Teams mode too) into the linked
 * Event's attendance roster. Ports the legacy syncTournamentAttendance() behaviour:
 * - identity-matches on staff_uid (falling back to the registration's user_id, which is always
 *   present in our schema, unlike legacy's optional email/name fallback) so re-syncing never
 *   duplicates a row.
 * - never overwrites an existing row's attended status.
 * - a roster row this sync previously created, whose registration is no longer Approved, is
 *   removed if attendance was never marked, or flagged 'Registration Changed' (kept) if it was.
 */
export async function syncTournamentAttendance(eventId: string, tournamentId: string) {
  const [{ data: registrations }, { data: attendance }] = await Promise.all([
    supabase.from('tournament_registrations').select('*').eq('tournament_id', tournamentId),
    supabase.from('event_attendance').select('*').eq('event_id', eventId),
  ]);
  const approved = (registrations ?? []).filter((r) => r.status === 'Approved');
  const approvedKeys = new Set(approved.map((r) => r.staff_uid || r.user_id));
  const existing = attendance ?? [];

  let added = 0;
  for (const r of approved) {
    const key = r.staff_uid || r.user_id;
    if (existing.some((a) => a.staff_uid === key)) continue;
    const { error } = await supabase.from('event_attendance').insert({
      event_id: eventId,
      staff_uid: key,
      staff_name: r.staff_name || r.email || 'Participant',
      contact_no: r.contact_no,
      attendance_status: 'Pending',
      attended: false,
      data: { source: 'Tournament', tournamentId, registrationId: r.id, teamName: r.team_id },
    } satisfies Partial<import('../../types/database').EventAttendanceRow>);
    if (!error) added++;
  }

  let flagged = 0;
  let removed = 0;
  for (const row of existing) {
    const source = row.data as { source?: string; tournamentId?: string } | null;
    if (source?.source !== 'Tournament' || source.tournamentId !== tournamentId) continue;
    if (approvedKeys.has(row.staff_uid)) continue;
    if (row.attended) {
      await supabase
        .from('event_attendance')
        .update({ data: { ...row.data, source: 'Tournament History' } })
        .eq('id', row.id);
      flagged++;
    } else {
      await supabase.from('event_attendance').delete().eq('id', row.id);
      removed++;
    }
  }

  return { added, flagged, removed };
}
