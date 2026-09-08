'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { applyReportFilters } from './filters';
import { exportReportCsv } from './export';
import { printReport } from './print';
import { REPORT_CATEGORIES, REPORT_DEFINITIONS, EMPTY_FILTERS } from './types';
import type { ReportCategory, ReportFilters, ReportResult } from './types';
import { runReport } from './queries';

function formatValue(value: unknown, type: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'money') return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 });
  return String(value);
}

export function ReportsPage() {
  const { isCommitteeUser } = useAuth();
  const [expandedCategory, setExpandedCategory] = useState<ReportCategory | null>('Finance & Budget');
  const [selectedId, setSelectedId] = useState('expense-register');
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  const selected = REPORT_DEFINITIONS.find((r) => r.id === selectedId)!;

  useEffect(() => {
    supabase.from('events').select('id,name').order('name').then(({ data }) => setEvents(data ?? []));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    runReport(selectedId, filters.from).then((r) => {
      if (active) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedId, filters.from]);

  const filteredRows = useMemo(() => (result ? applyReportFilters(result.rows, filters) : []), [result, filters]);

  const statusOptions = useMemo(
    () => Array.from(new Set((result?.rows ?? []).map((r) => r._status).filter((s): s is string => !!s))),
    [result]
  );

  const kpis = useMemo(() => {
    if (!result) return [];
    const numericCols = result.columns.filter((c) => c.type === 'money' || c.type === 'number').slice(0, 4);
    return numericCols.map((c) => ({
      label: c.label,
      value: filteredRows.reduce((sum, row) => sum + (Number(row[c.key]) || 0), 0),
      isMoney: c.type === 'money',
    }));
  }, [result, filteredRows]);

  if (!isCommitteeUser) return <div>Committee access required.</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Reports</h2>
          <p>Central reporting hub for finance, reimbursements, events, governance, and management reporting.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        <div>
          {REPORT_CATEGORIES.map((category) => {
            const reports = REPORT_DEFINITIONS.filter((r) => r.category === category);
            const expanded = expandedCategory === category;
            return (
              <div key={category} style={{ marginBottom: 8 }}>
                <button
                  className="btn ghost"
                  style={{ width: '100%', textAlign: 'left', fontWeight: 700 }}
                  onClick={() => setExpandedCategory(expanded ? null : category)}
                >
                  {expanded ? '▾' : '▸'} {category}
                </button>
                {expanded && (
                  <div style={{ paddingLeft: 12 }}>
                    {reports.map((r) => (
                      <button
                        key={r.id}
                        className={`btn ${selectedId === r.id ? 'soft' : 'ghost'}`}
                        style={{ width: '100%', textAlign: 'left', marginTop: 4, fontSize: 12 }}
                        onClick={() => setSelectedId(r.id)}
                      >
                        {r.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <h3 style={{ margin: '0 0 4px' }}>{selected.title}</h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>{selected.description}</p>

          <div className="toolbar">
            <div className="filters">
              <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} title="From" />
              <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} title="To" />
              <select value={filters.eventId} onChange={(e) => setFilters((f) => ({ ...f, eventId: e.target.value }))}>
                <option value="">All events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input placeholder="Search…" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
              <button className="btn ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
                Reset Filters
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn soft"
                disabled={!result}
                onClick={() => result && exportReportCsv(selected.title, result.columns, filteredRows)}
              >
                Export CSV
              </button>
              <button className="btn primary" disabled={!result} onClick={() => result && printReport(selected.title, result.columns, filteredRows)}>
                Print / Save PDF
              </button>
            </div>
          </div>

          {loading ? (
            <div>Loading report…</div>
          ) : (
            <>
              {kpis.length > 0 && (
                <div className="kpis">
                  {kpis.map((k) => (
                    <div className="kpi" key={k.label}>
                      <div className="lbl">{k.label}</div>
                      <strong>{k.isMoney ? k.value.toLocaleString(undefined, { minimumFractionDigits: 2 }) : k.value}</strong>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredRows.length} row(s)</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      {result?.columns.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => (
                      <tr key={i}>
                        {result?.columns.map((c) => (
                          <td key={c.key} className={c.type === 'money' || c.type === 'number' ? 'num' : undefined}>
                            {c.type === 'status' ? (
                              <span className="pill plan">{formatValue(row[c.key], c.type)}</span>
                            ) : (
                              formatValue(row[c.key], c.type)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!filteredRows.length && (
                      <tr>
                        <td colSpan={result?.columns.length ?? 1} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                          No rows match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
