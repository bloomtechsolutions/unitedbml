'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { ClassificationModal } from './ClassificationModal';
import type { ClassificationRow } from './types';
import { deleteClassification, useStaffAudience, useStaffRoster } from './useStaff';

type MatchFilter = '' | 'UNIT' | 'DEPARTMENT';
type CategoryFilter = '' | 'MALE_BASED' | 'ATOLL_BASED' | 'UNCLASSIFIED';

export function StaffAudiencePage() {
  const { isAdministrator } = useAuth();
  const { staff, loading: staffLoading } = useStaffRoster();
  const { rows, loading, reload } = useStaffAudience(staff);
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('');
  const [editing, setEditing] = useState<ClassificationRow | null>(null);

  const activeStaff = staff.filter((s) => s.status !== 'Inactive');
  const maleCount = activeStaff.filter((s) => {
    const row = rows.find((r) => r.matchType === 'UNIT' && r.value === s.unit) ?? rows.find((r) => r.matchType === 'DEPARTMENT' && r.value === s.department);
    return row?.category === 'MALE_BASED';
  }).length;
  const atollCount = activeStaff.filter((s) => {
    const row = rows.find((r) => r.matchType === 'UNIT' && r.value === s.unit) ?? rows.find((r) => r.matchType === 'DEPARTMENT' && r.value === s.department);
    return row?.category === 'ATOLL_BASED';
  }).length;
  const unclassifiedCount = activeStaff.length - maleCount - atollCount;

  const filtered = rows.filter((r) => {
    const matchesSearch = !search || r.value.toLowerCase().includes(search.toLowerCase());
    const matchesType = !matchFilter || r.matchType === matchFilter;
    const matchesCategory =
      !categoryFilter || (categoryFilter === 'UNCLASSIFIED' ? !r.category : r.category === categoryFilter);
    return matchesSearch && matchesType && matchesCategory;
  });

  const handleDelete = async (row: ClassificationRow) => {
    if (!row.mappingId) return;
    if (!confirm(`Remove the classification for "${row.value}"? It will read as Unclassified until reclassified.`)) return;
    await deleteClassification(row.mappingId);
    await reload();
    toast('Classification removed');
  };

  if (!isAdministrator) return <div>Administrator access required.</div>;
  if (loading || staffLoading) return <div>Loading Location Classification…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Location Classification</h2>
          <p>Map units and departments to an audience category (Male Based / Atoll Based) for event eligibility.</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="lbl">Male Based</div>
          <strong>{maleCount}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Atoll Based</div>
          <strong>{atollCount}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Unclassified</div>
          <strong>{unclassifiedCount}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Units / Departments</div>
          <strong>{rows.length}</strong>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <input placeholder="Search unit or department…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={matchFilter} onChange={(e) => setMatchFilter(e.target.value as MatchFilter)}>
            <option value="">Units & Departments</option>
            <option value="UNIT">Units only</option>
            <option value="DEPARTMENT">Departments only</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}>
            <option value="">All categories</option>
            <option value="MALE_BASED">Male Based</option>
            <option value="ATOLL_BASED">Atoll Based</option>
            <option value="UNCLASSIFIED">Unclassified</option>
          </select>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Value</th>
            <th>Staff Count</th>
            <th>Category</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={`${r.matchType}-${r.value}`}>
              <td>{r.matchType === 'UNIT' ? 'Unit' : 'Department'}</td>
              <td>
                {r.value}
                {r.matchType === 'DEPARTMENT' && <small style={{ color: 'var(--muted)' }}> · fallback only</small>}
              </td>
              <td>{r.count}</td>
              <td>
                <span className={`pill ${r.category === 'MALE_BASED' ? 'plan' : r.category === 'ATOLL_BASED' ? 'open' : 'archive'}`}>
                  {r.category ? r.category.replace('_', ' ') : 'Unclassified'}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={() => setEditing(r)}>
                  {r.mappingId ? 'Edit' : 'Classify'}
                </button>
                {r.mappingId && (
                  <button className="btn danger" onClick={() => void handleDelete(r)}>
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!filtered.length && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                No units or departments match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <ClassificationModal row={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  );
}
