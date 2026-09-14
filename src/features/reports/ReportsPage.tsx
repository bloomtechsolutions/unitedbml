'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageInfoPanel } from '../../components/PageInfoPanel';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { applyReportFilters } from './filters';
import { exportReportCsv } from './export';
import { printReport } from './print';
import { REPORT_CATEGORIES, REPORT_DEFINITIONS, EMPTY_FILTERS } from './types';
import type { ReportFilters, ReportResult } from './types';
import { runReport } from './queries';

function formatValue(value: unknown, type: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'money')
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
    });
  return String(value);
}

const REPORTS_INFO = [
  {
    q: 'How do I find a specific report?',
    a: 'Pick a Category from the first dropdown, then the report itself from the second — each category groups reports by area (Finance & Budget, Reimbursements & AP, Events & Attendance, Governance & Committee, Meetings & Engagement, Communication & Audit, Executive Reports).',
  },
  {
    q: 'What do the filters do?',
    a: 'Date range, event, status and free-text search all apply on top of whatever report is currently loaded — they narrow the rows shown and the KPI totals above the table, without changing which report you picked.',
  },
  {
    q: 'Can I export or print a report?',
    a: 'Yes — Export CSV downloads exactly the filtered rows currently on screen; Print / Save PDF opens a print-ready version of the same data.',
  },
  {
    q: 'Why is a KPI strip only sometimes shown?',
    a: "KPIs summarize a report's numeric columns (money or count) — a report with no numeric columns (like a directory) shows just the table.",
  },
];

export function ReportsPage() {
  const { isCommitteeUser } = useAuth();
  const [view, setView] = useState<'reports' | 'info'>('reports');
  const [selectedId, setSelectedId] = useState('expense-register');
  const selectedCategory =
    REPORT_DEFINITIONS.find((r) => r.id === selectedId)?.category ??
    'Finance & Budget';
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  const selected = REPORT_DEFINITIONS.find((r) => r.id === selectedId)!;

  useEffect(() => {
    supabase
      .from('events')
      .select('id,name')
      .order('name')
      .then(({ data }) => setEvents(data ?? []));
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

  const filteredRows = useMemo(
    () => (result ? applyReportFilters(result.rows, filters) : []),
    [result, filters],
  );

  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (result?.rows ?? [])
            .map((r) => r._status)
            .filter((s): s is string => !!s),
        ),
      ),
    [result],
  );

  const kpis = useMemo(() => {
    if (!result) return [];
    const numericCols = result.columns
      .filter((c) => c.type === 'money' || c.type === 'number')
      .slice(0, 4);
    return numericCols.map((c) => ({
      label: c.label,
      value: filteredRows.reduce(
        (sum, row) => sum + (Number(row[c.key]) || 0),
        0,
      ),
      isMoney: c.type === 'money',
    }));
  }, [result, filteredRows]);

  if (!isCommitteeUser) return <div>Committee access required.</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Reports</h2>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${view === 'reports' ? 'active' : ''}`} onClick={() => setView('reports')}>
          Reports
        </button>
        <button className={`tab ${view === 'info' ? 'active' : ''}`} onClick={() => setView('info')}>
          Info
        </button>
      </div>

      {view === 'info' && <PageInfoPanel sections={REPORTS_INFO} />}

      {view === 'reports' && (
      <>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="filters">
          <select
            value={selectedCategory}
            onChange={(e) => {
              const firstInCategory = REPORT_DEFINITIONS.find(
                (r) => r.category === e.target.value,
              );
              if (firstInCategory) setSelectedId(firstInCategory.id);
            }}
          >
            {REPORT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ minWidth: 260 }}
          >
            {REPORT_DEFINITIONS.filter(
              (r) => r.category === selectedCategory,
            ).map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 4px' }}>{selected.title}</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>
          {selected.description}
        </p>

        <div className="toolbar">
          <div className="filters">
            <input
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((f) => ({ ...f, from: e.target.value }))
              }
              title="From"
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) =>
                setFilters((f) => ({ ...f, to: e.target.value }))
              }
              title="To"
            />
            <select
              value={filters.eventId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, eventId: e.target.value }))
              }
            >
              <option value="">All events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
            >
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              placeholder="Search…"
              value={filters.search}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value }))
              }
            />
            <button
              className="btn ghost"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Reset Filters
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn soft"
              disabled={!result}
              onClick={() =>
                result &&
                exportReportCsv(selected.title, result.columns, filteredRows)
              }
            >
              Export CSV
            </button>
            <button
              className="btn primary"
              disabled={!result}
              onClick={() =>
                result &&
                printReport(selected.title, result.columns, filteredRows)
              }
            >
              Print / Save PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div>Loading report…</div>
        ) : (
          <>
            {kpis.length > 0 && (
              <div className="ub-kpi-strip">
                {kpis.map((k) => (
                  <div className="ub-kpi-strip-item" key={k.label}>
                    <span className="ub-kpi-strip-value">
                      {k.isMoney
                        ? k.value.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })
                        : k.value}
                    </span>
                    <span className="ub-kpi-strip-label">{k.label}</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              {filteredRows.length} row(s)
            </p>
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
                        <td
                          key={c.key}
                          className={
                            c.type === 'money' || c.type === 'number'
                              ? 'num'
                              : undefined
                          }
                        >
                          {c.type === 'status' ? (
                            <span className="pill plan">
                              {formatValue(row[c.key], c.type)}
                            </span>
                          ) : (
                            formatValue(row[c.key], c.type)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!filteredRows.length && (
                    <tr>
                      <td
                        colSpan={result?.columns.length ?? 1}
                        style={{ textAlign: 'center', color: 'var(--muted)' }}
                      >
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
      </>
      )}
    </div>
  );
}
