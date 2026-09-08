import type {
  EventRegistrationRow,
  EventRow,
  EventTeamRow,
  EventWinnerRow,
  ExternalEventOfficialRow,
} from '../../types/database';

export interface PortalEvent extends EventRow {
  teams: EventTeamRow[];
  registrations: EventRegistrationRow[];
  winners: EventWinnerRow[];
  myRegistration: EventRegistrationRow | null;
}

export interface MyEngagement {
  registrations: number;
  attendances: number;
  achievements: number;
  points: number;
  level: 'Starter' | 'Bronze' | 'Silver' | 'Gold';
}

export interface OfficialAssignment extends ExternalEventOfficialRow {
  eventName: string;
}
