import type { CommitteeMemberRow } from '../../types/database';
import type { EffectiveAvailability } from './types';

export function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Mirrors committeeEffectiveAvailability() in the legacy index.html: a member's raw
 * `availability` flag can go stale once a leave window has passed, so this derives the
 * currently-true status from the leave dates instead of trusting the flag alone.
 */
export function committeeEffectiveAvailability(
  member: Pick<CommitteeMemberRow, 'name' | 'availability' | 'leave_from' | 'leave_to'>,
  today: string = localTodayIso()
): EffectiveAvailability {
  if (!member.name || !member.name.trim()) return 'Vacant';
  if (member.availability !== 'On Leave') return 'Available';
  if (member.leave_from && member.leave_from > today) return 'Leave Scheduled';
  if (member.leave_to && member.leave_to < today) return 'Leave Ended';
  return 'On Leave';
}

export function isVacant(member: Pick<CommitteeMemberRow, 'name'>): boolean {
  return !member.name || !member.name.trim();
}
