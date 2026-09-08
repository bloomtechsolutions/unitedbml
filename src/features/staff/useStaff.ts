import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { StaffLocationClassificationRow, StaffRow } from '../../types/database';
import type { ClassificationRow, StaffImportRow } from './types';

export function useStaffRoster() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from('staff').select('*').order('full_name', { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setStaff(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { staff, loading, error, reload };
}

export async function upsertStaffRows(rows: (StaffImportRow & { status?: string })[]) {
  const payload = rows
    .filter((r) => r.uid.trim() && r.name.trim())
    .map((r) => ({
      uid: r.uid.trim(),
      name: r.name.trim(),
      job_title: r.jobTitle || null,
      division: r.division || null,
      department: r.department || null,
      unit: r.unit || null,
      status: r.status || 'Active',
    }));
  if (!payload.length) throw new Error('No valid rows to save (UID and Name are required).');
  const { data, error } = await supabase.rpc('upsert_staff_master_rows', { p_rows: payload });
  if (error) throw error;
  return data as { ok: boolean; affected: number };
}

export function useStaffAudience(staff: StaffRow[]) {
  const [mappings, setMappings] = useState<StaffLocationClassificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('staff_location_classification').select('*');
    setMappings(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = useMemo<ClassificationRow[]>(() => {
    const activeStaff = staff.filter((s) => s.status !== 'Inactive');
    const mapKey = (type: string, value: string) => `${type}|${value.trim().toLowerCase()}`;
    const mapByKey = new Map(mappings.filter((m) => m.active).map((m) => [mapKey(m.match_type, m.match_value), m] as const));

    const build = (type: 'UNIT' | 'DEPARTMENT', values: (string | null)[]): ClassificationRow[] => {
      const counts = new Map<string, number>();
      for (const v of values) {
        if (!v || !v.trim()) continue;
        counts.set(v.trim(), (counts.get(v.trim()) ?? 0) + 1);
      }
      return Array.from(counts.entries()).map(([value, count]) => {
        const mapping = mapByKey.get(mapKey(type, value));
        return {
          matchType: type,
          value,
          category: mapping?.audience_category ?? null,
          notes: mapping?.notes ?? null,
          mappingId: mapping?.id ?? null,
          count,
        };
      });
    };

    return [
      ...build('UNIT', activeStaff.map((s) => s.unit)),
      ...build('DEPARTMENT', activeStaff.map((s) => s.department)),
    ].sort((a, b) => a.matchType.localeCompare(b.matchType) || a.value.localeCompare(b.value));
  }, [staff, mappings]);

  return { rows, mappings, loading, reload };
}

export async function saveClassification(payload: {
  id: string | null;
  matchType: string;
  value: string;
  category: string;
  notes: string;
}) {
  if (payload.id) {
    const { error } = await supabase
      .from('staff_location_classification')
      .update({ audience_category: payload.category, notes: payload.notes || null, active: true })
      .eq('id', payload.id);
    if (error) throw error;
    return;
  }
  // Match the legacy save flow: a case-insensitive lookup-then-branch instead of a native
  // upsert(onConflict), since the DB unique constraint is case-sensitive but matching should not be.
  const { data: existing } = await supabase
    .from('staff_location_classification')
    .select('id')
    .eq('match_type', payload.matchType)
    .ilike('match_value', payload.value)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from('staff_location_classification')
      .update({ audience_category: payload.category, notes: payload.notes || null, active: true })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('staff_location_classification').insert({
      match_type: payload.matchType,
      match_value: payload.value,
      audience_category: payload.category,
      notes: payload.notes || null,
      active: true,
    });
    if (error) throw error;
  }
}

export async function deleteClassification(id: string) {
  const { error } = await supabase.from('staff_location_classification').delete().eq('id', id);
  if (error) throw error;
}
