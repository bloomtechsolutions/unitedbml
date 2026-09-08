import type {
  TournamentMatchRow,
  TournamentRegistrationRow,
  TournamentRow,
  TournamentTeamRow,
  TournamentUpdateRow,
  TournamentWinnerRow,
} from '../../types/database';

export interface TournamentWithChildren extends TournamentRow {
  eventName: string;
  teams: TournamentTeamRow[];
  registrations: TournamentRegistrationRow[];
  updates: TournamentUpdateRow[];
  matches: TournamentMatchRow[];
  winners: TournamentWinnerRow[];
}

export const TOURNAMENT_STATUSES = [
  'Setup',
  'Registration Open',
  'Registration Closed',
  'Scheduled',
  'Live',
  'Completed',
  'Cancelled',
] as const;

export const MATCH_STATUSES = ['Scheduled', 'Live', 'Completed', 'Postponed', 'Cancelled'] as const;

export const LIFECYCLE_STAGES = ['Setup', 'Registration', 'Scheduled', 'Live', 'Completed'] as const;

export function lifecycleStage(status: string): (typeof LIFECYCLE_STAGES)[number] {
  if (status === 'Registration Open' || status === 'Registration Closed') return 'Registration';
  if (status === 'Live') return 'Live';
  if (status === 'Completed' || status === 'Cancelled') return 'Completed';
  if (status === 'Scheduled') return 'Scheduled';
  return 'Setup';
}
