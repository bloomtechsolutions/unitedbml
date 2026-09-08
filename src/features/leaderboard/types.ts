export type LeaderboardView = 'overall' | 'events' | 'tournaments' | 'delivery';

export const LEADERBOARD_VIEWS: { key: LeaderboardView; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'events', label: 'Events' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'delivery', label: 'Delivery' },
];

export interface ActivityItem {
  type: 'event' | 'task' | 'tournament' | 'win';
  title: string;
  detail: string;
  points: number;
  at: string;
}

export interface LeaderboardRow {
  key: string;
  name: string;
  uid: string | null;
  email: string | null;
  department: string | null;
  points: number;
  eventPoints: number;
  tournamentPoints: number;
  taskPoints: number;
  achievementPoints: number;
  events: number;
  tournaments: number;
  tasks: number;
  wins: number;
  activity: ActivityItem[];
}

export type LeaderboardLevel = 'Starter' | 'Bronze' | 'Silver' | 'Gold';

export function leaderboardLevel(points: number): { level: LeaderboardLevel; next: number | null; floor: number; ceiling: number | null } {
  if (points >= 75) return { level: 'Gold', next: null, floor: 75, ceiling: null };
  if (points >= 40) return { level: 'Silver', next: 75 - points, floor: 40, ceiling: 75 };
  if (points >= 15) return { level: 'Bronze', next: 40 - points, floor: 15, ceiling: 40 };
  return { level: 'Starter', next: 15 - points, floor: 0, ceiling: 15 };
}

export function scoreForView(row: LeaderboardRow, view: LeaderboardView): number {
  if (view === 'events') return row.eventPoints;
  if (view === 'tournaments') return row.tournamentPoints;
  if (view === 'delivery') return row.taskPoints;
  return row.points;
}
