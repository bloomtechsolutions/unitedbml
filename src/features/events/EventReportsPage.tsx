'use client';

import { useMemo, useState } from 'react';
import { PageInfoPanel } from '../../components/PageInfoPanel';
import type { EventReportStatus } from '../../types/database';
import { EventReportModal } from './EventReportModal';
import { useEventReports } from './useEventReports';

const REPORTS_INFO = [
  {
    q: 'When does an Event Report get created?',
    a: "Automatically, the moment an event's Finance settlement is closed — a Draft report is created and the assigned coordinator is notified to fill it in.",
  },
  {
    q: 'What goes into a report?',
    a: 'Staff attended, volunteers, no-shows (pre-filled from the Attendance tab), highlights, an overall feedback rating and notes, challenges faced, recommendations, and photos.',
  },
  {
    q: 'What happens after Submit?',
    a: 'The President is notified to sign off. They can Approve it, or Return it with a comment for the coordinator to revise and resubmit.',
  },
  {
    q: 'Can I export a report?',
    a: 'Yes — Download PDF on any report produces a formatted Event Completion Report with the event/budget snapshot, attendance, feedback and an embedded photo gallery (up to 12 photos).',
  },
];

const STATUS_ORDER: EventReportStatus[] = ['Draft', 'Submitted', 'Returned', 'Approved'];

export function EventReportsPage() {
  const { reports, loading, error, reload } = useEventReports();
  const [subTab, setSubTab] = useState<'reports' | 'info'>('reports');
  const [statusFilter, setStatusFilter] = useState<EventReportStatus | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);

  const kpis = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        label: status === 'Draft' ? 'Needs Report' : status === 'Submitted' ? 'Awaiting Sign-off' : status,
        value: reports.filter((r) => r.status === status).length,
      })),
    [reports]
  );

  const visible = statusFilter ? reports.filter((r) => r.status === statusFilter) : reports;

  if (loading) return <div>Loading event reports…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load: {error}</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Event Reports</h2>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${subTab === 'reports' ? 'active' : ''}`} onClick={() => setSubTab('reports')}>
          Reports
        </button>
        <button className={`tab ${subTab === 'info' ? 'active' : ''}`} onClick={() => setSubTab('info')}>
          Info
        </button>
      </div>

      {subTab === 'info' && <PageInfoPanel sections={REPORTS_INFO} />}

      {subTab === 'reports' && (
        <>
          <div className="ub-kpi-strip">
            {kpis.map((k) => (
              <div className="ub-kpi-strip-item" key={k.label}>
                <span className="ub-kpi-strip-value">{k.value}</span>
                <span className="ub-kpi-strip-label">{k.label}</span>
              </div>
            ))}
          </div>

          <div className="toolbar" style={{ marginBottom: 14 }}>
            <div className="filters">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as EventReportStatus | '')}>
                <option value="">All statuses</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Event Date</th>
                  <th>Coordinator</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>{r.event?.name || '—'}</td>
                    <td>{r.event?.event_date ? new Date(r.event.event_date).toLocaleDateString('en-GB') : '—'}</td>
                    <td>{r.event?.coordinator || '—'}</td>
                    <td>
                      <span className={`pill ${r.status === 'Approved' ? 'plan' : ''}`}>{r.status}</span>
                    </td>
                    <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-GB') : '—'}</td>
                    <td>
                      <button className="btn soft" onClick={() => setOpenId(r.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No event reports yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <EventReportModal reportId={openId} onClose={() => setOpenId(null)} onSaved={reload} />
    </div>
  );
}
