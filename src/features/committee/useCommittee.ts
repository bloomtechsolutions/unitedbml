import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { CommitteeMemberRow } from '../../types/database';
import type { CommitteeMemberWithMeta, CommitteeTerm, DirectoryUser, StaffProfilePreview } from './types';

function withMeta(row: CommitteeMemberRow): CommitteeMemberWithMeta {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    ...row,
    parentId: typeof data.parentId === 'string' ? data.parentId : null,
    displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
  };
}

export function useCommitteeMembers() {
  const [members, setMembers] = useState<CommitteeMemberWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from('committee_members').select('*');
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []).map(withMeta).sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.role.localeCompare(b.role);
    });
    setMembers(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { members, loading, error, reload };
}

export function useCommitteeTerm() {
  const [term, setTerm] = useState<CommitteeTerm | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'clubCommitteeTermV1')
      .maybeSingle();
    setTerm((data?.setting_value as unknown as CommitteeTerm) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { term, loading, reload };
}

export async function saveCommitteeTerm(start: string, end: string) {
  const value = { start, end, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from('app_settings')
    .upsert({ setting_key: 'clubCommitteeTermV1', setting_value: value }, { onConflict: 'setting_key' });
  if (error) throw error;

  // Legacy behaviour: the shared term is written onto every currently-assigned member's
  // term_start/term_end whenever it changes (see V17/V18 report — there is no per-member term).
  const { error: propagateError } = await supabase
    .from('committee_members')
    .update({ term_start: start, term_end: end })
    .not('name', 'is', null)
    .neq('name', '');
  if (propagateError) throw propagateError;
}

export function useDirectoryUsers() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('profiles')
      .select('id,full_name,email,role,member_uid,contact_no')
      .eq('status', 'Active')
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        if (active) {
          setUsers(data ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { users, loading };
}

export async function fetchMemberStaffProfile(committeeId: string): Promise<StaffProfilePreview | null> {
  const { data, error } = await supabase.rpc('committee_member_staff_profile', { p_committee_id: committeeId });
  if (error) throw error;
  if (!data || Object.keys(data as object).length === 0) return null;
  return data as unknown as StaffProfilePreview;
}

export async function assignCommitteeMember(id: string, payload: Partial<CommitteeMemberRow>) {
  const { error } = await supabase.from('committee_members').update(payload).eq('id', id);
  if (error) throw error;
}

export async function clearCommitteeAssignment(id: string) {
  const { error } = await supabase
    .from('committee_members')
    .update({
      name: null,
      uid: null,
      contact: null,
      email: null,
      user_id: null,
      staff_uid: null,
      term_start: null,
      term_end: null,
      status: 'Active',
      availability: 'Available',
      leave_from: null,
      leave_to: null,
      notes: null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function resetAllAssignments(memberIds: string[]) {
  if (!memberIds.length) return;
  const { error } = await supabase
    .from('committee_members')
    .update({
      name: null,
      uid: null,
      contact: null,
      email: null,
      user_id: null,
      staff_uid: null,
      status: 'Active',
      availability: 'Available',
      leave_from: null,
      leave_to: null,
      notes: null,
    })
    .in('id', memberIds);
  if (error) throw error;
}

export async function createPosition(payload: {
  id: string;
  role: string;
  group_name: string | null;
  icon: string | null;
}) {
  const { error } = await supabase.from('committee_members').insert(payload);
  if (error) throw error;
}

export async function updatePosition(
  id: string,
  payload: Partial<Pick<CommitteeMemberRow, 'role' | 'group_name' | 'icon'>>
) {
  const { error } = await supabase.from('committee_members').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deletePosition(id: string) {
  const { error } = await supabase.from('committee_members').delete().eq('id', id);
  if (error) throw error;
}

export async function saveStructure(id: string, currentData: Record<string, unknown>, parentId: string | null, displayOrder: number) {
  const { error } = await supabase
    .from('committee_members')
    .update({ data: { ...currentData, parentId, displayOrder } })
    .eq('id', id);
  if (error) throw error;
}
