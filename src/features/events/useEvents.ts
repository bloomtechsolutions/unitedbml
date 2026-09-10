"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { EventAttendanceRow, EventRow, EventTaskRow } from '../../types/database';
import type { CommitteeMemberOption, EventWithChildren, StaffOption } from './types';

function assemble(events: EventRow[], tasks: EventTaskRow[], attendance: EventAttendanceRow[]): EventWithChildren[] {
  return events.map((event) => ({
    ...event,
    tasks: tasks.filter((t) => t.event_id === event.id),
    attendance: attendance.filter((a) => a.event_id === event.id),
  }));
}

export function useEvents() {
  const [events, setEvents] = useState<EventWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [eventsRes, tasksRes, attendanceRes] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: true }),
      supabase.from('event_tasks').select('*'),
      supabase.from('event_attendance').select('*'),
    ]);
    const firstError = eventsRes.error || tasksRes.error || attendanceRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setEvents(assemble(eventsRes.data ?? [], tasksRes.data ?? [], attendanceRes.data ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, loading, error, reload };
}

export function useCommitteeMembers() {
  const [members, setMembers] = useState<CommitteeMemberOption[]>([]);

  useEffect(() => {
    let active = true;
    supabase
      .from('committee_members')
      .select('id,name,role,status')
      .eq('status', 'Active')
      .then(({ data }) => {
        if (active) setMembers(data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  return members;
}

export function useEventTypes() {
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    supabase
      .from('event_types')
      .select('name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (active) setTypes((data ?? []).map((t) => t.name));
      });
    return () => {
      active = false;
    };
  }, []);

  return types;
}

export function useStaffSearch(query: string) {
  const [results, setResults] = useState<StaffOption[]>([]);

  useEffect(() => {
    let active = true;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      supabase
        .from('staff')
        .select('id,uid,full_name,contact_no')
        .eq('status', 'Active')
        .ilike('full_name', `%${query}%`)
        .limit(10)
        .then(({ data }) => {
          if (active) setResults(data ?? []);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  return results;
}

export function useActiveStaffDirectory() {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('staff')
      .select('id,uid,full_name,contact_no,department')
      .eq('status', 'Active')
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        if (active) {
          setStaff(data ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { staff, loading };
}

export async function createEvent(payload: Partial<EventRow>) {
  const id = payload.id ?? String(Date.now());
  const { error } = await supabase.from('events').insert({ ...payload, id });
  if (error) throw error;
  return id;
}

export async function updateEvent(id: string, payload: Partial<EventRow>) {
  const { error } = await supabase.from('events').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertTask(task: Partial<EventTaskRow> & { event_id: string; source_key: string }) {
  const { error } = await supabase.from('event_tasks').upsert(task, { onConflict: 'event_id,source_key' });
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('event_tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertAttendance(row: Partial<EventAttendanceRow> & { event_id: string; staff_uid: string }) {
  const { error } = await supabase.from('event_attendance').upsert(row, { onConflict: 'event_id,staff_uid' });
  if (error) throw error;
}

export async function bulkAddAttendance(eventId: string, staff: StaffOption[]) {
  if (!staff.length) return;
  const rows = staff.map((s) => ({
    event_id: eventId,
    staff_uid: s.uid,
    staff_name: s.full_name,
    contact_no: s.contact_no,
    attendance_status: 'Pending',
    attended: false,
  }));
  const { error } = await supabase.from('event_attendance').upsert(rows, { onConflict: 'event_id,staff_uid', ignoreDuplicates: true });
  if (error) throw error;
}

export async function deleteAttendance(id: string) {
  const { error } = await supabase.from('event_attendance').delete().eq('id', id);
  if (error) throw error;
}

export async function updateEventAttendanceCount(eventId: string, count: number) {
  const { error } = await supabase
    .from('events')
    .update({ attendance_count: count, attendance_updated_at: new Date().toISOString() })
    .eq('id', eventId);
  if (error) throw error;
}

