import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { StandingAllocationEntryRow, StandingAllocationRow } from '../../types/database';

export function useStandingAllocations() {
  const [allocations, setAllocations] = useState<StandingAllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('standing_allocations')
      .select('*')
      .order('cadence', { ascending: true })
      .order('name', { ascending: true });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setAllocations(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { allocations, loading, error, reload };
}

export function useAllocationEntries() {
  const [entries, setEntries] = useState<StandingAllocationEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('standing_allocation_entries')
      .select('*')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setEntries(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { entries, loading, error, reload };
}

export async function saveAllocation(
  payload: Partial<StandingAllocationRow>,
  id: string | null,
  userId: string | undefined
) {
  if (id) {
    const { error } = await supabase
      .from('standing_allocations')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('standing_allocations')
      .insert({ ...payload, created_by: userId ?? null });
    if (error) throw error;
  }
}

export async function setAllocationActive(id: string, active: boolean) {
  const { error } = await supabase
    .from('standing_allocations')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function addAllocationEntry(payload: {
  allocation_id: string;
  period_year: number;
  period_month: number;
  actual_amount: number;
  description: string | null;
  source_reference: string | null;
  recorded_by: string | undefined;
  recorded_by_name: string | undefined;
}) {
  const { error } = await supabase.from('standing_allocation_entries').insert({
    allocation_id: payload.allocation_id,
    period_year: payload.period_year,
    period_month: payload.period_month,
    actual_amount: payload.actual_amount,
    description: payload.description,
    source_reference: payload.source_reference,
    recorded_by: payload.recorded_by ?? null,
    recorded_by_name: payload.recorded_by_name ?? null,
  });
  if (error) throw error;
}

export async function deleteAllocationEntry(id: string) {
  const { error } = await supabase.from('standing_allocation_entries').delete().eq('id', id);
  if (error) throw error;
}

export function actualTotal(entries: StandingAllocationEntryRow[], allocationId: string, year?: number): number {
  return entries
    .filter((e) => e.allocation_id === allocationId && (year === undefined || e.period_year === year))
    .reduce((sum, e) => sum + (e.actual_amount || 0), 0);
}
