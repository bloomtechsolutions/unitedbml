import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface ExcoActivityRow {
  eventId: string;
  name: string;
  eventType: string | null;
  date: string | null;
  planned: number;
  approved: number;
  actual: number;
  variance: number;
  settlementStatus: string;
  expectedParticipants: number;
  attendanceCount: number;
}

export function useExcoReport() {
  const [rows, setRows] = useState<ExcoActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [eventsRes, requestsRes] = await Promise.all([
      supabase
        .from('events')
        .select('id,name,event_type,event_date,planned_budget,actual_expense_total,finance_settlement_status,expected_participants,attendance_count')
        .eq('archived', false)
        .order('event_date', { ascending: false }),
      supabase.from('expense_requests').select('event_id,status,total_amount').eq('status', 'Approved'),
    ]);
    const firstError = eventsRes.error || requestsRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    const approvedByEvent = new Map<string, number>();
    for (const r of requestsRes.data ?? []) {
      if (!r.event_id) continue;
      approvedByEvent.set(r.event_id, (approvedByEvent.get(r.event_id) ?? 0) + (r.total_amount || 0));
    }
    setRows(
      (eventsRes.data ?? []).map((e) => {
        const approved = approvedByEvent.get(e.id) ?? 0;
        return {
          eventId: e.id,
          name: e.name,
          eventType: e.event_type,
          date: e.event_date,
          planned: e.planned_budget || 0,
          approved,
          actual: e.actual_expense_total || 0,
          variance: approved - (e.actual_expense_total || 0),
          settlementStatus: e.finance_settlement_status || 'Pending Actuals',
          expectedParticipants: e.expected_participants || 0,
          attendanceCount: e.attendance_count || 0,
        };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, error, reload };
}
