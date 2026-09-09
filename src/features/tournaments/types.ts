import type {
  TournamentMatchRow,
  TournamentRegistrationRow,
  TournamentRow,
  TournamentTeamRow,
  TournamentUpdateRow,
  TournamentWinnerRow,
} from '../../types/database';
import { localTodayIso } from '../events/lifecycle';

export interface TournamentWithChildren extends TournamentRow {
  eventName: string;
  eventDate: string | null;
  eventCancelled: boolean;
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

/** V13.16 Simplified Tournament: the linked Event's date drives the display phase — the raw
 * `tournaments.status` column only matters pre-event-day (Setup/Registration Open/Closed). */
export const DISPLAY_PHASES = ['Setup', 'Registration Open', 'Registration Closed', 'Event Day', 'Results Pending', 'Completed'] as const;
export type DisplayPhase = (typeof DISPLAY_PHASES)[number] | 'Cancelled';

export function tournamentDisplayPhase(
  status: string,
  eventDate: string | null,
  hasResults: boolean,
  eventCancelled: boolean
): DisplayPhase {
  const today = localTodayIso();
  if (status === 'Cancelled' || eventCancelled) return 'Cancelled';
  if (eventDate && eventDate < today) return hasResults ? 'Completed' : 'Results Pending';
  if (eventDate === today) return hasResults ? 'Completed' : 'Event Day';
  if (status === 'Registration Open') return 'Registration Open';
  if (status === 'Registration Closed') return 'Registration Closed';
  return 'Setup';
}
