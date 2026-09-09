'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { CommitteeMemberRow, StaffRow } from '../../types/database';
import { useStaffRoster } from '../staff/useStaff';
import { committeeEffectiveAvailability, isVacant } from './availability';
import { MemberFormModal } from './MemberFormModal';
import { MemberViewModal } from './MemberViewModal';
import { TermModal } from './TermModal';
import { PositionAdminModal } from './PositionAdminModal';
import type { CommitteeMemberWithMeta, EffectiveAvailability } from './types';
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
type SortKey = 'position' | 'member' | 'group' | 'status';
type PageTab = 'positions' | 'structure' | 'directory';

function initials(name: string | null): string {
  if (!name) return '—';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function OrgNode({
  member,
  staffByUid,
  allMembers,
}: {
  member: CommitteeMemberWithMeta;
  staffByUid: Map<string, StaffRow>;
  allMembers: CommitteeMemberWithMeta[];
}) {
  const staff = member.staff_uid ? staffByUid.get(member.staff_uid) : undefined;
  const childMembers = allMembers.filter((m) => m.parentId === member.id).sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div className="org-node">
        <div className="committee-avatar" style={{ margin: '0 auto 6px' }}>
          {isVacant(member) ? '—' : initials(member.name)}
        </div>
        <strong>{member.role}</strong>
        <span>{isVacant(member) ? 'Vacant' : member.name}</span>
        {staff?.job_title && <span>{staff.job_title}</span>}
      </div>
      {!!childMembers.length && (
        <div className="org-row">
          {childMembers.map((c) => (
            <OrgNode key={c.id} member={c} staffByUid={staffByUid} allMembers={allMembers} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommitteePage() {
  const { isAdministrator, isCommitteeUser } = useAuth();
  const { members, loading, error, reload } = useCommitteeMembers();
  const { term, reload: reloadTerm } = useCommitteeTerm();
  const { users: directory } = useDirectoryUsers();
  const { staff } = useStaffRoster();
  const toast = useToast();

  const [pageTab, setPageTab] = useState<PageTab>('positions');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [sortKey, setSortKey] = useState<SortKey>('position');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [editing, setEditing] = useState<CommitteeMemberRow | null>(null);
  const [viewing, setViewing] = useState<CommitteeMemberRow | null>(null);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const staffByUid = useMemo(() => new Map(staff.map((s) => [s.uid, s] as const)), [staff]);

  const groups = useMemo(
    () => Array.from(new Set(members.map((m) => m.group_name).filter((g): g is string => !!g))),
    [members]
  );

  const assignedUserIds = useMemo(
    () => new Set(members.filter((m) => m.user_id).map((m) => m.user_id as string)),
    [members]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = members.filter((member) => {
      const s = member.staff_uid ? staffByUid.get(member.staff_uid) : undefined;
      const matchesSearch =
        !q ||
        member.role.toLowerCase().includes(q) ||
        (member.name || '').toLowerCase().includes(q) ||
        (s?.job_title || '').toLowerCase().includes(q) ||
        (s?.division || '').toLowerCase().includes(q) ||
        (s?.department || '').toLowerCase().includes(q) ||
        (s?.unit || '').toLowerCase().includes(q);
      const matchesGroup = !groupFilter || member.group_name === groupFilter;
      const effective = committeeEffectiveAvailability(member);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'Assigned' && !isVacant(member)) ||
        (statusFilter === 'Vacant' && isVacant(member)) ||
        statusFilter === effective;
      return matchesSearch && matchesGroup && matchesStatus;
    });
    const sorted = [...rows];
    if (sortKey === 'position') sorted.sort((a, b) => a.role.localeCompare(b.role));
    else if (sortKey === 'member') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortKey === 'group') sorted.sort((a, b) => (a.group_name || '').localeCompare(b.group_name || ''));
    else if (sortKey === 'status')
      sorted.sort((a, b) => committeeEffectiveAvailability(a).localeCompare(committeeEffectiveAvailability(b)));
    return sorted;
  }, [members, search, groupFilter, statusFilter, sortKey, staffByUid]);

  const summary = {
    assigned: members.filter((m) => !isVacant(m)).length,
    vacant: members.filter((m) => isVacant(m)).length,
    available: members.filter((m) => committeeEffectiveAvailability(m) === 'Available').length,
    onLeave: members.filter((m) => committeeEffectiveAvailability(m) === 'On Leave').length,
  };

  const termProgress = useMemo(() => {
    if (!term) return null;
    const today = new Date().toISOString().slice(0, 10);
    const total = daysBetween(term.start, term.end);
    if (total <= 0) return null;
    const elapsed = Math.max(0, Math.min(total, daysBetween(term.start, today)));
    const pct = Math.round((elapsed / total) * 100);
    const remaining = daysBetween(today, term.end);
    return { pct, remainingLabel: remaining > 0 ? `${remaining} days remaining` : remaining === 0 ? 'Ends today' : 'Term ended' };
  }, [term]);

  const roots = useMemo(() => members.filter((m) => !m.parentId).sort((a, b) => a.displayOrder - b.displayOrder), [members]);

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

  const clearFilters = () => {
    setSearch('');
    setGroupFilter('');
    setStatusFilter('');
    setSortKey('position');
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
          {termProgress && (
            <div className="committee-term-overview-progress">
              <div className="committee-term-overview-track">
                <span style={{ width: `${termProgress.pct}%` }} />
              </div>
              <div className="committee-term-overview-foot">
                <strong>{termProgress.pct}% complete</strong>
                <span>{termProgress.remainingLabel}</span>
              </div>
            </div>
          )}
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

      <div className="tabs">
        <button className={`tab ${pageTab === 'positions' ? 'active' : ''}`} onClick={() => setPageTab('positions')}>
          Positions
        </button>
        <button className={`tab ${pageTab === 'structure' ? 'active' : ''}`} onClick={() => setPageTab('structure')}>
          Structure
        </button>
        <button className={`tab ${pageTab === 'directory' ? 'active' : ''}`} onClick={() => setPageTab('directory')}>
          Directory
        </button>
      </div>

      {pageTab === 'positions' && (
        <>
          <div className="committee-filterbar">
            <input
              placeholder="Search position, member, job title, division…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="position">Sort: Position</option>
              <option value="member">Sort: Member</option>
              <option value="group">Sort: Group</option>
              <option value="status">Sort: Status</option>
            </select>
            <button className="btn ghost" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>

          <div className="committee-roster">
            {filtered.map((member) => {
              const effective = committeeEffectiveAvailability(member);
              const open = expandedId === member.id;
              const staffProfile = member.staff_uid ? staffByUid.get(member.staff_uid) : undefined;
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
                      <small>{staffProfile?.job_title || member.status}</small>
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
                        {staffProfile && (
                          <>
                            <div className="committee-detail-row">
                              <small>Division</small>
                              <strong>{staffProfile.division || '—'}</strong>
                            </div>
                            <div className="committee-detail-row">
                              <small>Department</small>
                              <strong>{staffProfile.department || '—'}</strong>
                            </div>
                            <div className="committee-detail-row">
                              <small>Unit</small>
                              <strong>{staffProfile.unit || '—'}</strong>
                            </div>
                          </>
                        )}
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
        </>
      )}

      {pageTab === 'structure' && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h3>Club Management Structure</h3>
          </div>
          <div className="org-chart">
            <div className="org-row">
              {roots.map((m) => (
                <OrgNode key={m.id} member={m} staffByUid={staffByUid} allMembers={members} />
              ))}
            </div>
          </div>
          {!roots.length && <p style={{ color: 'var(--muted)' }}>No positions configured yet.</p>}
        </div>
      )}

      {pageTab === 'directory' && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h3>Committee Directory</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Name</th>
                <th>Job Title</th>
                <th>Department</th>
                <th>Unit</th>
                <th>UID</th>
                <th>Availability</th>
                <th>Term</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const staffProfile = member.staff_uid ? staffByUid.get(member.staff_uid) : undefined;
                return (
                  <tr key={member.id}>
                    <td>{member.role}</td>
                    <td>{isVacant(member) ? <em style={{ color: 'var(--muted)' }}>Vacant</em> : member.name}</td>
                    <td>{staffProfile?.job_title || '—'}</td>
                    <td>{staffProfile?.department || '—'}</td>
                    <td>{staffProfile?.unit || '—'}</td>
                    <td>{member.uid || staffProfile?.uid || '—'}</td>
                    <td>{committeeEffectiveAvailability(member)}</td>
                    <td>
                      {member.term_start || '—'} → {member.term_end || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MemberFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        member={editing}
        directory={directory}
        assignedUserIds={assignedUserIds}
        term={term}
        staffByUid={staffByUid}
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
