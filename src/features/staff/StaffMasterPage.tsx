'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useCommitteeMembers } from '../committee/useCommittee';
import { isVacant } from '../committee/availability';
import { StaffEditModal } from './StaffEditModal';
import { StaffImportModal } from './StaffImportModal';
import type { StaffRow } from '../../types/database';
import { useStaffRoster } from './useStaff';

export function StaffMasterPage() {
  const { isAdministrator } = useAuth();
  const { staff, loading, error, reload } = useStaffRoster();
  const { members: committeeMembers } = useCommitteeMembers();

  const committeeRoleByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of committeeMembers) {
      if (!isVacant(m) && m.staff_uid) map.set(m.staff_uid, m.role);
    }
    return map;
  }, [committeeMembers]);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);

  const departments = useMemo(() => Array.from(new Set(staff.map((s) => s.department).filter((d): d is string => !!d))), [staff]);
  const units = useMemo(() => Array.from(new Set(staff.map((s) => s.unit).filter((u): u is string => !!u))), [staff]);

  const active = staff.filter((s) => s.status !== 'Inactive');
  const withDepartment = active.filter((s) => s.department).length;
  const withUnit = active.filter((s) => s.unit).length;
  const missing = active.filter((s) => !s.department || !s.unit).length;

  const filtered = staff.filter((s) => {
    const matchesSearch =
      !search ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.uid.toLowerCase().includes(search.toLowerCase());
    const matchesDept = !departmentFilter || s.department === departmentFilter;
    const matchesUnit = !unitFilter || s.unit === unitFilter;
    const matchesMissing = !missingOnly || !s.department || !s.unit;
    return matchesSearch && matchesDept && matchesUnit && matchesMissing;
  });

  if (!isAdministrator) return <div>Administrator access required.</div>;
  if (loading) return <div>Loading Staff Master…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load staff: {error}</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Staff Master</h2>
          <p>The source of truth for staff org data — Committee, Events, and Tournaments all resolve into this.</p>
        </div>
        <div className="actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => setImportOpen(true)}>
            Bulk Import
          </button>
          <button className="btn primary" onClick={() => setEditing(null)}>
            + Add Staff
          </button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="lbl">Total Staff</div>
          <strong>{staff.length}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">With Department</div>
          <strong>{withDepartment}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">With Unit</div>
          <strong>{withUnit}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Missing Org Data</div>
          <strong>{missing}</strong>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <input placeholder="Search name or UID…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
            <option value="">All units</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
            Missing org data only
          </label>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>UID</th>
            <th>Name</th>
            <th>Job Title</th>
            <th>Division</th>
            <th>Department</th>
            <th>Unit</th>
            <th>UnitedBML</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id}>
              <td>{s.uid}</td>
              <td>{s.full_name}</td>
              <td>{s.job_title || '—'}</td>
              <td>{s.division || '—'}</td>
              <td>{s.department || '—'}</td>
              <td>{s.unit || '—'}</td>
              <td>
                {committeeRoleByUid.has(s.uid) ? (
                  <span className="pill plan">{committeeRoleByUid.get(s.uid)}</span>
                ) : (
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>Staff Member</span>
                )}
              </td>
              <td>
                <span className={`pill ${s.status === 'Inactive' ? 'cancel' : 'open'}`}>{s.status}</span>
              </td>
              <td>
                <button className="btn ghost" onClick={() => setEditing(s)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {!filtered.length && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                No staff records match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <StaffEditModal open={editing !== undefined} onClose={() => setEditing(undefined)} editing={editing ?? null} onSaved={reload} />
      <StaffImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={reload} />
    </div>
  );
}
