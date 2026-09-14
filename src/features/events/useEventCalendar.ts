import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { PlannedActivityRow, PublicHolidayRow } from '../../types/database';

export function usePlannedActivities() {
  const [activities, setActivities] = useState<PlannedActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('event_planned_activities').select('*').order('planned_date');
    setActivities(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { activities, loading, reload };
}

export function usePublicHolidays() {
  const [holidays, setHolidays] = useState<PublicHolidayRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('public_holidays').select('*').order('holiday_date');
    setHolidays(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { holidays, loading, reload };
}

export async function createPlannedActivity(payload: {
  name: string;
  planned_date: string;
  notes: string | null;
  created_by: string | undefined;
  created_by_name: string | undefined;
}) {
  const { error } = await supabase.from('event_planned_activities').insert({
    name: payload.name,
    planned_date: payload.planned_date,
    notes: payload.notes,
    created_by: payload.created_by ?? null,
    created_by_name: payload.created_by_name ?? null,
  });
  if (error) throw error;
}

export async function deletePlannedActivity(id: string) {
  const { error } = await supabase.from('event_planned_activities').delete().eq('id', id);
  if (error) throw error;
}

export async function markPlannedActivityPromoted(id: string, eventId: string) {
  const { error } = await supabase
    .from('event_planned_activities')
    .update({ promoted_event_id: eventId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function saveHoliday(payload: Partial<PublicHolidayRow>, id: string | null) {
  if (id) {
    const { error } = await supabase
      .from('public_holidays')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('public_holidays').insert(payload);
    if (error) throw error;
  }
}

export async function deleteHoliday(id: string) {
  const { error } = await supabase.from('public_holidays').delete().eq('id', id);
  if (error) throw error;
}
