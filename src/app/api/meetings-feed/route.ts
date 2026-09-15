import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { buildIcsCalendar, buildIcsEvent } from '../../../lib/ics';

export const runtime = 'nodejs';

/**
 * Public (token-authenticated) iCalendar feed of UnitedBML meetings — meant to be added to
 * Outlook/Google Calendar as a "subscribe from URL" feed, which re-fetches this endpoint
 * periodically with a plain GET and no way to attach a Supabase session header. Access is
 * gated by a per-user secret token (calendar_feed_tokens) instead, issued and shown on the
 * Settings page.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Calendar feed is not configured on the server.' }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: tokenRow } = await admin.from('calendar_feed_tokens').select('user_id').eq('token', token).maybeSingle();
  if (!tokenRow) {
    return NextResponse.json({ error: 'Invalid or revoked calendar feed link.' }, { status: 404 });
  }

  const { data: meetings, error } = await admin
    .from('meetings')
    .select('id,title,meeting_type,meeting_date,meeting_time,location,chair,secretary,purpose,cancelled')
    .eq('cancelled', false)
    .not('meeting_date', 'is', null)
    .order('meeting_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load meetings.' }, { status: 500 });
  }

  const vevents = (meetings ?? [])
    .filter((m) => m.meeting_date)
    .map((m) =>
      buildIcsEvent({
        uid: `meeting-${m.id}@unitedbml`,
        date: m.meeting_date as string,
        time: m.meeting_time,
        title: m.title,
        location: m.location,
        description: [m.meeting_type, m.purpose, m.chair ? `Chair: ${m.chair}` : null, m.secretary ? `Secretary: ${m.secretary}` : null]
          .filter(Boolean)
          .join('\n'),
      })
    );

  const ics = buildIcsCalendar(vevents, 'UnitedBML Meetings');

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="unitedbml-meetings.ics"',
      'Cache-Control': 'private, max-age=1800',
    },
  });
}
