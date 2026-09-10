import type { EventAttendanceRow, EventRow, EventTaskRow, StaffRow, TournamentWinnerRow } from '../../types/database';
import type { ActivityItem, LeaderboardRow } from './types';

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

interface Inputs {
  events: EventRow[];
  attendance: EventAttendanceRow[];
  tasks: EventTaskRow[];
  winners: TournamentWinnerRow[];
  staff: StaffRow[];
}

/**
 * Committee-driven leaderboard: attendance (marked by committee on the event roster), completed
 * prep tasks, and recorded event winners/achievements — no self-service registration, since only
 * committee members use this app and every input here is something committee itself enters.
 */
export function computeLeaderboard(inputs: Inputs): LeaderboardRow[] {
  const { events, attendance, tasks, winners, staff } = inputs;
  const eventById = new Map(events.map((e) => [e.id, e] as const));
  const staffByUid = new Map(staff.map((s) => [normalize(s.uid), s] as const));
  const staffByEmail = new Map(staff.filter((s) => s.email).map((s) => [normalize(s.email), s] as const));
  const nameToKey = new Map<string, string>();

  const rows = new Map<string, LeaderboardRow>();

  function keyFor(uid: string | null, email: string | null, name: string): string {
    if (uid && normalize(uid)) return `uid:${normalize(uid)}`;
    if (email && normalize(email)) return `email:${normalize(email)}`;
    return `name:${normalize(name)}`;
  }

  function ensureRow(uid: string | null, email: string | null, name: string): LeaderboardRow {
    const key = keyFor(uid, email, name);
    let row = rows.get(key);
    if (!row) {
      const staffMatch = (uid && staffByUid.get(normalize(uid))) || (email && staffByEmail.get(normalize(email))) || null;
      row = {
        key,
        name: name || staffMatch?.full_name || 'Unknown',
        uid: uid || staffMatch?.uid || null,
        email: email || staffMatch?.email || null,
        department: staffMatch?.department ?? null,
        points: 0,
        eventPoints: 0,
        taskPoints: 0,
        achievementPoints: 0,
        events: 0,
        tasks: 0,
        wins: 0,
        activity: [],
      };
      rows.set(key, row);
      if (name) nameToKey.set(normalize(name), key);
    }
    return row;
  }

  function addActivity(row: LeaderboardRow, item: ActivityItem) {
    row.activity.push(item);
  }

  // Event attendance: +3 once per person per event, credited when marked attended by committee.
  for (const a of attendance) {
    if (!a.attended) continue;
    const event = eventById.get(a.event_id);
    const row = ensureRow(a.staff_uid, null, a.staff_name);
    row.points += 3;
    row.eventPoints += 3;
    row.events += 1;
    addActivity(row, {
      type: 'event',
      title: 'Attended event',
      detail: event?.name ?? 'Event',
      points: 3,
      at: a.marked_at ?? '',
    });
  }

  // Completed tasks: +2, credited by owner name (event_tasks has no owner UID) — matched against
  // an already-known person by name where possible, same fuzzy resolution as legacy.
  for (const t of tasks) {
    if (!t.done && t.status !== 'Completed') continue;
    if (!t.owner) continue;
    const event = eventById.get(t.event_id);
    const existingKey = nameToKey.get(normalize(t.owner));
    const row = existingKey ? (rows.get(existingKey) as LeaderboardRow) : ensureRow(null, null, t.owner);
    row.points += 2;
    row.taskPoints += 2;
    row.tasks += 1;
    addActivity(row, {
      type: 'task',
      title: 'Completed task',
      detail: `${t.task_text} (${event?.name ?? 'Event'})`,
      points: 2,
      at: t.updated_at,
    });
  }

  // Event winners/achievements, recorded by committee: +10 for 1st/"winner", +5 otherwise.
  for (const w of winners) {
    const isTop = /winner/i.test(w.position) || w.position.trim() === '1';
    const points = isTop ? 10 : 5;
    const row = ensureRow(w.staff_uid, null, w.winner_name);
    row.points += points;
    row.achievementPoints += points;
    row.wins += 1;
    addActivity(row, {
      type: 'win',
      title: `Result: ${w.position}`,
      detail: w.winner_name,
      points,
      at: w.created_at,
    });
  }

  for (const row of rows.values()) {
    row.activity.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    row.activity = row.activity.slice(0, 8);
  }

  return Array.from(rows.values());
}
