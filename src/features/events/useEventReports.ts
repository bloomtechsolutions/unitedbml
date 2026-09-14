"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { EventReportPhotoRow, EventReportRow, EventReportStatus, EventRow } from '../../types/database';

export type EventReportEventSnapshot = Pick<
  EventRow,
  | 'id'
  | 'name'
  | 'event_type'
  | 'event_date'
  | 'venue'
  | 'coordinator'
  | 'coordinator_role'
  | 'expected_participants'
  | 'attendance_count'
  | 'planned_budget'
  | 'actual_expense_total'
  | 'finance_settlement_status'
>;

export interface EventReportWithEvent extends EventReportRow {
  event: EventReportEventSnapshot | null;
}

const EVENT_SNAPSHOT_SELECT =
  'id,name,event_type,event_date,venue,coordinator,coordinator_role,expected_participants,attendance_count,planned_budget,actual_expense_total,finance_settlement_status';

export function useEventReports() {
  const [reports, setReports] = useState<EventReportWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('event_reports')
      .select(`*, event:events(${EVENT_SNAPSHOT_SELECT})`)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setReports((data ?? []) as unknown as EventReportWithEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { reports, loading, error, reload };
}

export function useEventReportPhotos(reportId: string | null) {
  const [photos, setPhotos] = useState<EventReportPhotoRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!reportId) {
      setPhotos([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('event_report_photos')
      .select('*')
      .eq('event_report_id', reportId)
      .order('sort_order', { ascending: true });
    setPhotos(data ?? []);
    setLoading(false);
  }, [reportId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { photos, loading, reload };
}

export async function updateEventReport(id: string, payload: Partial<EventReportRow>) {
  const { error } = await supabase
    .from('event_reports')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function submitEventReport(id: string, submittedByUserId: string, submittedByName: string) {
  const { error } = await supabase
    .from('event_reports')
    .update({
      status: 'Submitted' satisfies EventReportStatus,
      submitted_by: submittedByUserId,
      submitted_by_name: submittedByName,
      submitted_at: new Date().toISOString(),
      president_decision: null,
      president_comment: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function decideEventReport(
  id: string,
  decision: 'Approved' | 'Returned',
  comment: string,
  decidedByName: string,
  decidedByRole: string
) {
  const { error } = await supabase
    .from('event_reports')
    .update({
      status: decision satisfies EventReportStatus,
      president_decision: decision,
      president_comment: comment || null,
      decided_by_name: decidedByName,
      decided_by_role: decidedByRole,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function addReportPhoto(
  reportId: string,
  storagePath: string,
  caption: string,
  sortOrder: number,
  uploadedBy: string | null
) {
  const { error } = await supabase.from('event_report_photos').insert({
    event_report_id: reportId,
    storage_path: storagePath,
    caption: caption || null,
    sort_order: sortOrder,
    uploaded_by: uploadedBy,
  });
  if (error) throw error;
}

export async function deleteReportPhoto(id: string) {
  const { error } = await supabase.from('event_report_photos').delete().eq('id', id);
  if (error) throw error;
}

/** Fallback for an event that closed out financially before this feature existed, or whose
 * trigger-created draft is otherwise missing — creates the Draft report on demand so there's
 * never a dead end getting into a report. */
export async function ensureDraftReport(event: EventReportEventSnapshot): Promise<string> {
  const { data: existing } = await supabase.from('event_reports').select('id').eq('event_id', event.id).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from('event_reports')
    .insert({
      event_id: event.id,
      staff_attended: event.attendance_count ?? 0,
      no_show_count: Math.max((event.expected_participants ?? 0) - (event.attendance_count ?? 0), 0),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
