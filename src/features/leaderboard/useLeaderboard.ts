import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { computeLeaderboard } from './compute';
import type { LeaderboardRow } from './types';

export function useLeaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from('events').select('*'),
      supabase.from('event_attendance').select('*'),
      supabase.from('event_tasks').select('*'),
      supabase.from('tournament_winners').select('*'),
      supabase.from('staff').select('*'),
    ]).then(([eventsRes, attendanceRes, tasksRes, winnersRes, staffRes]) => {
      if (!active) return;
      const firstError = eventsRes.error || attendanceRes.error || tasksRes.error || winnersRes.error || staffRes.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }
      setRows(
        computeLeaderboard({
          events: eventsRes.data ?? [],
          attendance: attendanceRes.data ?? [],
          tasks: tasksRes.data ?? [],
          winners: winnersRes.data ?? [],
          staff: staffRes.data ?? [],
        })
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { rows, loading, error };
}
