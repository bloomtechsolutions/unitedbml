import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { MeetingAttendeeRow, MeetingRow } from '../../types/database';
import { localTodayIso } from '../meetings/status';

export interface MyMeetingSummary {
  meeting: MeetingRow;
  myAttendance: MeetingAttendeeRow | null;
  totalExpected: number;
  totalCheckedIn: number;
}

export function useMyMeetings(userId: string | undefined) {
  const [myCommitteeId, setMyCommitteeId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<MyMeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setSummaries([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: cm } = await supabase.from('committee_members').select('id').eq('user_id', userId).maybeSingle();
    const committeeId = cm?.id ?? null;
    setMyCommitteeId(committeeId);

    if (!committeeId) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    const today = localTodayIso();
    const { data: myAttendees } = await supabase
      .from('meeting_attendees')
      .select('*')
      .eq('committee_id', committeeId);

    const meetingIds = (myAttendees ?? []).map((a) => a.meeting_id);
    if (!meetingIds.length) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    const [{ data: meetings }, { data: allAttendees }] = await Promise.all([
      supabase
        .from('meetings')
        .select('*')
        .in('id', meetingIds)
        .eq('cancelled', false)
        .gte('meeting_date', today)
        .order('meeting_date', { ascending: true })
        .limit(5),
      supabase.from('meeting_attendees').select('*').in('meeting_id', meetingIds),
    ]);

    const built = (meetings ?? []).map((meeting) => {
      const attendeesForMeeting = (allAttendees ?? []).filter((a) => a.meeting_id === meeting.id);
      return {
        meeting,
        myAttendance: attendeesForMeeting.find((a) => a.committee_id === committeeId) ?? null,
        totalExpected: attendeesForMeeting.length,
        totalCheckedIn: attendeesForMeeting.filter((a) => a.attendance_status === 'Present').length,
      };
    });

    setSummaries(built);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { summaries, myCommitteeId, loading, reload };
}
