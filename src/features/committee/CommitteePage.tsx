'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { CommitteeMemberRow } from '../../types/database';
import { committeeEffectiveAvailability, isVacant } from './availability';
import { MemberFormModal } from './MemberFormModal';
import { MemberViewModal } from './MemberViewModal';
import { TermModal } from './TermModal';
import { PositionAdminModal } from './PositionAdminModal';
import type { EffectiveAvailability } from './types';
import {
  assignCommitteeMember,
  clearCommitteeAssignment,
  resetAllAssignments,
  saveCommitteeTerm,
  useCommitteeMembers,
  useCommitteeTerm,
  useDirectoryUsers,
} from './useCommittee';

type StatusFilter = '' | 'Assigned' | 'Vacant' | EffectiveAvailability;

export function CommitteePage() {
  const { isAdministrator, isCommitteeUser } = useAuth();
  const { members, loading, error, reload } = useCommitteeMembers();
  const { term, reload: reloadTerm } = useCommitteeTerm();
  const { users: directory } = useDirectoryUsers();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [editing, setEditing] = useState<CommitteeMemberRow | null>(null);
  const [viewing, setViewing] = useState<CommitteeMemberRow | null>(null);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const groups = useMemo(
    () => Array.from(new Set(members.map((m) => m.group_name).filter((g): g is string => !!g))),
    [members]
  );

  const assignedUserIds = useMemo(
    () => new Set(members.filter((m) => m.user_id).map((m) => m.user_id as string)),
    [members]
  );

  const filtered = members.filter((member) => {
    const matchesSearch =
      !search ||
      member.role.toLowerCase().includes(search.toLowerCase()) ||
      (member.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesGroup = !groupFilter || member.group_name === groupFilter;
    const effective = committeeEffectiveAvailability(member);
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'Assigned' && !isVacant(member)) ||
      (statusFilter === 'Vacant' && isVacant(member)) ||
      statusFilter === effective;
    return matchesSearch && matchesGroup && matchesStatus;
  });

  const summary = {
    assigned: members.filter((m) => !isVacant(m)).length,
    vacant: members.filter((m) => isVacant(m)).length,
    available: members.filter((m) => committeeEffectiveAvailability(m) === 'Available').length,
    onLeave: members.filter((m) => committeeEffectiveAvailability(m) === 'On Leave').length,
  };

  const handleSaveAssignment = async (payload: Partial<CommitteeMemberRow>) => {
    if (!editing) return;
    await assignCommitteeMember(editing.id, payload);
    await reload();
    toast('Committee assignment saved');
  };

  const handleClearAssignment = async (member: CommitteeMemberRow) => {
    if (!confirm(`Vacate "${member.role}"? This clears the current assignment.`)) return;
    await clearCommitteeAssignment(member.id);
    await reload();
    toast('Assignment cleared');
  };

  const handleResetAll = async () => {
    if (!confirm('Clear ALL committee assignments? Position titles are kept, only occupants are removed.')) return;
    await resetAllAssignments(members.filter((m) => !isVacant(m)).map((m) => m.id));
    await reload();
    toast('All assignments reset');
  };

  const handleSaveTerm = async (start: string, end: string) => {
    await saveCommitteeTerm(start, end);
    await reloadTerm();
    await reload();
    toast('Committee term updated');
  };

  if (loading) return <div>Loading committee…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load committee: {error}</div>;

  return (
    <div>
      <div className="committee-hero">
        <div>
          <h2>Committee</h2>
          <p>Manage roles, assignments, availability, and the club-wide committee term.</p>
        </div>
        <div className="actions" style={{ display: 'flex', gap: 8 }}>
          {isCommitteeUser && (
            <button className="btn soft" onClick={() => setTermModalOpen(true)}>
              Committee Term
            </button>
          )}
          {isAdministrator && (
            <button className="btn soft" onClick={() => setAdminModalOpen(true)}>
              Manage Positions
            </button>
          )}
          {isCommitteeUser && (
            <button className="btn ghost" onClick={() => void handleResetAll()}>
              Reset All Assignments
            </button>
          )}
        </div>
      </div>

      {term && (
        <div className="committee-term-overview">
          <div className="committee-term-overview-head">
            <div>
              <div className="committee-overline">Current Term</div>
              <h3>
                {term.start} → {term.end}
              </h3>
              <div className="committee-term-range">Applies to all assigned committee members</div>
            </div>
          </div>
        </div>
      )}

      <div className="committee-summary-chips">
        <div className="committee-summary-chip">
          <strong>{summary.assigned}</strong>
          <span>Assigned</span>
        </div>
        <div className="committee-summary-chip">
          <strong>{summary.vacant}</strong>
          <span>Vacant</span>
        </div>
        <div className="committee-summary-chip">
          <strong>{summary.available}</strong>
          <span>Available</span>
        </div>
        <div className="committee-summary-chip">
          <strong>{summary.onLeave}</strong>
          <span>On Leave</span>
        </div>
      </div>

      <div className="committee-filterbar">
        <input placeholder="Search position or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="">All statuses</option>
          <option value="Assigned">Assigned</option>
          <option value="Vacant">Vacant</option>
          <option value="Available">Available</option>
          <option value="On Leave">On Leave</option>
          <option value="Leave Scheduled">Leave Scheduled</option>
          <option value="Leave Ended">Leave Ended</option>
        </select>
        <div />
        <div />
      </div>

      <div className="committee-roster">
        {filtered.map((member) => {
          const effective = committeeEffectiveAvailability(member);
          const open = expandedId === member.id;
          return (
            <div key={member.id} className={`committee-roster-item ${open ? 'open' : ''}`}>
              <div className="committee-roster-main">
                <div className="committee-roster-role">
                  <h4>{member.role}</h4>
                  <small>{member.group_name || 'Unassigned group'}</small>
                </div>
                <div className="committee-roster-member">
                  {isVacant(member) ? (
                    <strong className="vacant-name">Vacant</strong>
                  ) : (
                    <strong>{member.name}</strong>
                  )}
                  <small>{member.status}</small>
                </div>
                <div className="committee-roster-contact">
                  <div>{member.email || '—'}</div>
                  <div>{member.contact || '—'}</div>
                </div>
                <div className="committee-roster-status">
                  <span className={`pill ${effective === 'Available' ? 'open' : effective === 'Vacant' ? 'archive' : 'plan'}`}>
                    {effective}
                  </span>
                </div>
              </div>
              <div className="committee-roster-actions">
                <button className="btn ghost" onClick={() => setViewing(member)}>
                  View
                </button>
                {isCommitteeUser && (
                  <button className="btn ghost" onClick={() => setEditing(member)}>
                    {isVacant(member) ? 'Assign' : 'Edit'}
                  </button>
                )}
                {isCommitteeUser && !isVacant(member) && (
                  <button className="btn danger" onClick={() => void handleClearAssignment(member)}>
                    Vacate
                  </button>
                )}
                <button
                  className="details-toggle"
                  onClick={() => setExpandedId(open ? null : member.id)}
                >
                  {open ? 'Hide details' : 'View details'}
                </button>
              </div>
              {open && (
                <div className="committee-roster-expanded">
                  <div className="committee-detail-list">
                    <div className="committee-detail-row">
                      <small>Term</small>
                      <strong>
                        {member.term_start || '—'} → {member.term_end || '—'}
                      </strong>
                    </div>
                    <div className="committee-detail-row">
                      <small>Leave Window</small>
                      <strong>
                        {member.leave_from || '—'} → {member.leave_to || '—'}
                      </strong>
                    </div>
                    <div className="committee-detail-row">
                      <small>Notes</small>
                      <strong>{member.notes || '—'}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!filtered.length && <div className="committee-roster-empty">No positions match your filters.</div>}
      </div>

      <MemberFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        member={editing}
        directory={directory}
        assignedUserIds={assignedUserIds}
        term={term}
        onSave={handleSaveAssignment}
      />

      <MemberViewModal
        member={viewing}
        onClose={() => setViewing(null)}
        onEdit={(member) => {
          setViewing(null);
          setEditing(member);
        }}
      />

      <TermModal open={termModalOpen} onClose={() => setTermModalOpen(false)} term={term} onSave={handleSaveTerm} />

      <PositionAdminModal
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        members={members}
        onRefresh={reload}
      />
    </div>
  );
}
