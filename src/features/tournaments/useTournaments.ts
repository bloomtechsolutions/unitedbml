import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { TournamentWinnerRow } from '../../types/database';

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

/** Ensures a lightweight tournaments row exists for this Event so results can be recorded
 * against it, without requiring the full tournament registration/teams workspace. */
export async function ensureTournamentForEvent(eventId: string, eventName: string): Promise<string> {
  const { data: existing } = await supabase.from('tournaments').select('id').eq('event_id', eventId).maybeSingle();
  if (existing) return existing.id;
  const id = `TRN-${eventId.replace(/[^A-Za-z0-9_-]/g, '')}`;
  const { error } = await supabase.from('tournaments').insert({
    id,
    event_id: eventId,
    name: eventName,
    status: 'Completed',
    data: { manualWinnersOnly: true },
  });
  if (error) throw error;
  return id;
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

/** Winners recorded for an Event, resolved through its linked tournaments row (if any). */
export function useEventWinners(eventId: string) {
  const [winners, setWinners] = useState<TournamentWinnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!eventId) {
      setWinners([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: tournament } = await supabase.from('tournaments').select('id').eq('event_id', eventId).maybeSingle();
    if (!tournament) {
      setWinners([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('tournament_winners')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('created_at', { ascending: true });
    setWinners(data ?? []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { winners, loading, reload };
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
