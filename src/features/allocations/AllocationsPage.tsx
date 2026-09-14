'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { StandingAllocationRow } from '../../types/database';
import { AllocationEntriesModal } from './AllocationEntriesModal';
import { AllocationFormModal } from './AllocationFormModal';
import { actualTotal, setAllocationActive, useAllocationEntries, useStandingAllocations } from './useAllocations';

export function AllocationsPage() {
  const { isCommitteeUser } = useAuth();
  const toast = useToast();
  const { allocations, loading, error, reload } = useStandingAllocations();
  const { entries, reload: reloadEntries } = useAllocationEntries();

  const [year, setYear] = useState(new Date().getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StandingAllocationRow | null>(null);
  const [entriesFor, setEntriesFor] = useState<StandingAllocationRow | null>(null);

  const years = useMemo(() => {
    const fromEntries = entries.map((e) => e.period_year);
    const fromAllocations = allocations.map((a) => a.budget_year);
    const all = new Set([...fromEntries, ...fromAllocations, new Date().getFullYear()]);
    return Array.from(all).sort((a, b) => b - a);
  }, [entries, allocations]);

  const visibleAllocations = allocations.filter((a) => a.budget_year === year);

  const kpis = useMemo(() => {
    const ytdTotal = visibleAllocations.reduce((s, a) => s + actualTotal(entries, a.id, year), 0);
    const pooled = visibleAllocations.filter((a) => a.cadence === 'Annual').reduce((s, a) => s + a.allocated_amount, 0);
    const now = new Date();
    const thisMonthTotal = entries
      .filter(
        (e) =>
          e.period_year === now.getFullYear() &&
          e.period_month === now.getMonth() + 1 &&
          visibleAllocations.some((a) => a.id === e.allocation_id)
      )
      .reduce((s, e) => s + (e.actual_amount || 0), 0);
    return [
      { label: `Actual (${year})`, value: ytdTotal, isMoney: true },
      { label: 'Annual Pools Allocated', value: pooled, isMoney: true },
      { label: 'This Month Actual', value: thisMonthTotal, isMoney: true },
      { label: 'Active Activities', value: visibleAllocations.filter((a) => a.active).length, isMoney: false },
    ];
  }, [visibleAllocations, entries, year]);

  const refreshAll = async () => {
    await Promise.all([reload(), reloadEntries()]);
  };

  const handleToggleActive = async (a: StandingAllocationRow) => {
    try {
      await setAllocationActive(a.id, !a.active);
      await reload();
      toast(a.active ? 'Activity deactivated.' : 'Activity reactivated.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update activity.');
    }
  };

  if (!isCommitteeUser) return <div>Committee access required.</div>;
  if (loading) return <div>Loading standing allocations…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load: {error}</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Standing Allocations</h2>
        </div>
        <div className="actions" style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + New Activity
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: -6, marginBottom: 14 }}>
        Pre-approved activities run outside UnitedBML but funded from the UBML account — e.g. Fun with Team, UBML
        Allowance, Women's Day, Men's Day, Year End Activities. Log Finance's monthly actuals here for visibility.
      </p>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="filters">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ub-kpi-strip">
        {kpis.map((k) => (
          <div className="ub-kpi-strip-item" key={k.label}>
            <span className="ub-kpi-strip-value">
              {k.isMoney ? Number(k.value).toLocaleString(undefined, { minimumFractionDigits: 2 }) : k.value}
            </span>
            <span className="ub-kpi-strip-label">{k.label}</span>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Cadence</th>
              <th className="num">Allocated</th>
              <th className="num">Actual ({year})</th>
              <th className="num">Remaining</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleAllocations.map((a) => {
              const actual = actualTotal(entries, a.id, year);
              const remaining = a.cadence === 'Annual' ? a.allocated_amount - actual : null;
              return (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.cadence}</td>
                  <td className="num">
                    {a.cadence === 'Annual' ? a.allocated_amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="num">{actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="num">
                    {remaining === null ? '—' : remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span className={`pill ${a.active ? 'plan' : ''}`}>{a.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn soft" onClick={() => setEntriesFor(a)}>
                        Monthly Actuals
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setEditing(a);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button className="btn ghost" onClick={() => void handleToggleActive(a)}>
                        {a.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!visibleAllocations.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No standing activities for {year} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AllocationFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        allocation={editing}
        onSaved={refreshAll}
      />
      <AllocationEntriesModal
        open={!!entriesFor}
        onClose={() => setEntriesFor(null)}
        allocation={entriesFor}
        entries={entries}
        onSaved={refreshAll}
      />
    </div>
  );
}
