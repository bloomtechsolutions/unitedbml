'use client';

import { useMemo, useState } from 'react';
import { printReport } from '../reports/print';
import type { ReportColumn, ReportRow } from '../reports/types';
import { useExcoReport } from './excoReport';

interface Props {
  annualBudget: number;
}

export function ExcoReportTab({ annualBudget }: Props) {
  const { rows, loading, reload } = useExcoReport();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('');

  const eventTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.eventType).filter((t): t is string => !!t))), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fromDate && r.date && r.date < fromDate) return false;
        if (toDate && r.date && r.date > toDate) return false;
        if (typeFilter && r.eventType !== typeFilter) return false;
        if (settlementFilter && r.settlementStatus !== settlementFilter) return false;
        return true;
      }),
    [rows, fromDate, toDate, typeFilter, settlementFilter]
  );

  const totals = useMemo(() => {
    const approved = filtered.reduce((s, r) => s + r.approved, 0);
    const actual = filtered.reduce((s, r) => s + r.actual, 0);
    const planned = filtered.reduce((s, r) => s + r.planned, 0);
    const available = Math.max(0, annualBudget - approved);
    const pendingSettlement = filtered.filter((r) => r.settlementStatus !== 'Closed').length;
    const expected = filtered.reduce((s, r) => s + r.expectedParticipants, 0);
    const attended = filtered.reduce((s, r) => s + r.attendanceCount, 0);
    return {
      approved,
      actual,
      planned,
      available,
      variance: approved - actual,
      pendingSettlement,
      attendancePct: expected ? Math.round((attended / expected) * 100) : 0,
    };
  }, [filtered, annualBudget]);

  const bar = (value: number) => (annualBudget ? Math.min(100, Math.round((value / annualBudget) * 100)) : 0);

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setTypeFilter('');
    setSettlementFilter('');
  };

  const columns: ReportColumn[] = [
    { key: 'name', label: 'Activity', type: 'text' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'planned', label: 'Planned', type: 'money' },
    { key: 'approved', label: 'Approved', type: 'money' },
    { key: 'actual', label: 'Actual', type: 'money' },
    { key: 'variance', label: 'Variance', type: 'money' },
    { key: 'settlementStatus', label: 'Settlement', type: 'status' },
  ];
  const printRows: ReportRow[] = filtered.map((r) => ({
    _date: r.date,
    _eventId: r.eventId,
    _eventName: r.name,
    _status: r.settlementStatus,
    name: r.name,
    date: r.date,
    planned: r.planned,
    approved: r.approved,
    actual: r.actual,
    variance: r.variance,
    settlementStatus: r.settlementStatus,
  }));

  if (loading) return <div>Loading Exco report…</div>;

  return (
    <div>
      <div className="card exco-summary-card">
        <div className="exco-summary-grid">
          <div className="exco-summary-text">
            <h3>Exco Activity Finance Report</h3>
            <p>
              A cleaner executive summary of budgets, approved spending, actual expenses and settlement status. Use
              the filters below to focus the report and print/export when needed.
            </p>
            <div className="exco-metric-list">
              <div className="exco-metric-row">
                <label>Approved vs Annual Budget</label>
                <div className="track">
                  <span style={{ width: `${bar(totals.approved)}%` }} />
                </div>
                <b>MVR {totals.approved.toLocaleString()}</b>
              </div>
              <div className="exco-metric-row">
                <label>Actual vs Annual Budget</label>
                <div className="track">
                  <span style={{ width: `${bar(totals.actual)}%` }} />
                </div>
                <b>MVR {totals.actual.toLocaleString()}</b>
              </div>
              <div className="exco-metric-row">
                <label>Planned vs Annual Budget</label>
                <div className="track">
                  <span style={{ width: `${bar(totals.planned)}%` }} />
                </div>
                <b>MVR {totals.planned.toLocaleString()}</b>
              </div>
              <div className="exco-metric-row">
                <label>Available Balance</label>
                <div className="track">
                  <span style={{ width: `${bar(totals.available)}%` }} />
                </div>
                <b>MVR {totals.available.toLocaleString()}</b>
              </div>
            </div>
          </div>
          <div className="exco-compact-stats">
            <div className="exco-compact-item">
              <small>Annual Budget</small>
              <strong>MVR {annualBudget.toLocaleString()}</strong>
            </div>
            <div className="exco-compact-item">
              <small>Variance</small>
              <strong className={totals.variance < 0 ? undefined : 'good'}>MVR {totals.variance.toLocaleString()}</strong>
            </div>
            <div className="exco-compact-item">
              <small>Activities in Report</small>
              <strong>{filtered.length}</strong>
            </div>
            <div className="exco-compact-item">
              <small>Pending Settlement</small>
              <strong>{totals.pendingSettlement}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="exco-section-head">
          <div>
            <h3 style={{ margin: 0 }}>Detailed Financial Register</h3>
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
              Filter activities and review approved budget, actual expense and utilization in one structured table.
            </div>
          </div>
        </div>
        <div className="exco-toolbar">
          <div className="exco-filters">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Event Types</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={settlementFilter} onChange={(e) => setSettlementFilter(e.target.value)}>
              <option value="">All Settlement Statuses</option>
              <option>Pending Actuals</option>
              <option>Actuals Entered</option>
              <option>Closed</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={resetFilters}>
              Reset
            </button>
            <button className="btn ghost" onClick={() => void reload()}>
              ↻ Refresh
            </button>
            <button className="btn primary" onClick={() => printReport('Exco Activity Finance Report', columns, printRows)}>
              🖨 Print / Save PDF
            </button>
          </div>
        </div>
        <div className="exco-table-wrap">
          <table className="table exco-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Date</th>
                <th>Planned</th>
                <th>Approved</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>Settlement</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.eventId}>
                  <td>{r.name}</td>
                  <td>{r.date || '—'}</td>
                  <td>{r.planned.toLocaleString()}</td>
                  <td>{r.approved.toLocaleString()}</td>
                  <td>{r.actual.toLocaleString()}</td>
                  <td style={{ color: r.variance < 0 ? 'var(--danger)' : undefined }}>{r.variance.toLocaleString()}</td>
                  <td>
                    <span className="pill plan">{r.settlementStatus}</span>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No activities match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="exco-section-head" style={{ marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Event Attendance Summary</h3>
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                Participation summary for activities included in this Exco report.
              </div>
            </div>
            <div className="pill blue">{totals.attendancePct}% Overall</div>
          </div>
          <div className="exco-table-wrap">
            <table className="table exco-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Expected</th>
                  <th>Attended</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.eventId}>
                    <td>{r.name}</td>
                    <td>{r.expectedParticipants || '—'}</td>
                    <td>{r.attendanceCount}</td>
                    <td>{r.expectedParticipants ? Math.round((r.attendanceCount / r.expectedParticipants) * 100) : '—'}%</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No attendance data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
