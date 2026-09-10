import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ExternalEventOfficialRow, ExternalEventReimbursementRow, Profile } from '../../types/database';
import type { MyApprovalItem, MyTaskItem, OfficialAssignment } from './types';

/** Resolves the logged-in user's own committee_members row, so tasks/meetings can be scoped to
 * them specifically rather than shown organization-wide. */
export function useMyCommitteeId(userId: string | undefined) {
  const [committeeId, setCommitteeId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setCommitteeId(null);
      return;
    }
    supabase
      .from('committee_members')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setCommitteeId(data?.id ?? null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return committeeId;
}

export function useMyOpenTasks(committeeId: string | null) {
  const [tasks, setTasks] = useState<MyTaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!committeeId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows } = await supabase
      .from('event_tasks')
      .select('*')
      .eq('owner_committee_id', committeeId)
      .eq('done', false)
      .order('due_date', { ascending: true, nullsFirst: false });
    const eventIds = Array.from(new Set((rows ?? []).map((t) => t.event_id)));
    const { data: events } = eventIds.length ? await supabase.from('events').select('id,name').in('id', eventIds) : { data: [] };
    const names = new Map((events ?? []).map((e) => [e.id, e.name] as const));
    setTasks((rows ?? []).map((t) => ({ ...t, eventName: names.get(t.event_id) ?? 'Event' })));
    setLoading(false);
  }, [committeeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { tasks, loading, reload };
}

/** Finance expense requests waiting specifically on this user's own decision — President
 * recommendation, or final approval where they are the selected final approver. */
export function useMyPendingApprovals(profile: Profile | null) {
  const [items, setItems] = useState<MyApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('expense_requests')
      .select('id,title,request_number,status,total_amount,final_approver_email,final_approver_name')
      .in('status', ['Pending President Recommendation', 'Pending Final Approval']);

    const email = (profile.email || '').toLowerCase().trim();
    const name = (profile.full_name || '').toLowerCase().trim();
    const isPresident = profile.role === 'President';

    const mine = (data ?? []).filter((r) => {
      if (r.status === 'Pending President Recommendation') return isPresident;
      const selected = (r.final_approver_email || '').toLowerCase().trim();
      return selected ? email === selected : (r.final_approver_name || '').toLowerCase().trim() === name;
    });

    setItems(
      mine.map((r) => ({
        id: r.id,
        title: r.title,
        request_number: r.request_number,
        status: r.status,
        total_amount: r.total_amount ?? 0,
        stage: r.status === 'Pending President Recommendation' ? 'President Recommendation' : 'Final Approval',
      }))
    );
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, reload };
}

/**
 * External Event Officials: committee assigns an existing account (e.g. a hired referee/scorer,
 * or a committee member helping run an event) as an official for one event; that person then
 * submits their own reimbursement claim, which committee approves under Reimbursements → External.
 * Committee-initiated and committee-approved throughout — distinct from the general staff
 * self-registration flow, so this stays even though the participant self-service portal doesn't.
 */
export async function assignExternalOfficial(eventId: string, userId: string, role: string, assignedBy: string) {
  const { error } = await supabase
    .from('external_event_officials')
    .upsert(
      { event_id: eventId, user_id: userId, official_role: role, status: 'Active', assigned_by: assignedBy },
      { onConflict: 'event_id,user_id' }
    );
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
