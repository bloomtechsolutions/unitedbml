'use client';

import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';
import { useStaffReimbursementWorkspace } from './useStaffReimbursements';

function money(n: number): string {
  return `MVR ${Math.round(n).toLocaleString()}`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function daysUntil(dateIso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateIso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function StaffDashboardPage() {
  const { profile } = useAuth();
  const { summaries, cases, batches, totals, loading } = useStaffReimbursementWorkspace();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = summaries
    .filter((s) => s.event.event_date && s.event.event_date >= today)
    .sort((a, b) => (a.event.event_date! < b.event.event_date! ? -1 : 1))[0];

  const recentBatches = [...batches]
    .filter((b) => b.status !== 'Cancelled')
    .sort((a, b) => new Date(b.manager_submitted_at || b.created_at).getTime() - new Date(a.manager_submitted_at || a.created_at).getTime())
    .slice(0, 6);

  return (
    <div>
      <div className="ub-page-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ub-ink-faint)', marginBottom: 4 }}>
            MY DASHBOARD
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>
            {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p>
            {summaries.length
              ? `You manage reimbursement for ${summaries.length} event${summaries.length > 1 ? 's' : ''}${
                  totals.pendingReview ? ` — ${totals.pendingReview} submission${totals.pendingReview > 1 ? 's' : ''} awaiting committee review` : ''
                }.`
              : "You'll see your assigned events here once a committee member assigns you as a Reimbursement Manager."}
          </p>
        </div>
        <Link href="/portal" className="ub-btn ub-btn-primary">
          Go to My Space
        </Link>
      </div>

      {!loading && summaries.length > 0 && (
        <div className="ub-kpi-strip">
          <div className="ub-kpi-strip-item">
            <span className="ub-kpi-strip-value">{summaries.length}</span>
            <span className="ub-kpi-strip-label">Assigned Events</span>
          </div>
          <div className="ub-kpi-strip-item">
            <span className="ub-kpi-strip-value">{money(totals.approved)}</span>
            <span className="ub-kpi-strip-label">Total Approved</span>
          </div>
          <div className="ub-kpi-strip-item">
            <span className="ub-kpi-strip-value">{money(totals.balance)}</span>
            <span className="ub-kpi-strip-label">Balance Remaining</span>
          </div>
          <div className="ub-kpi-strip-item">
            <span className="ub-kpi-strip-value">{money(totals.paid)}</span>
            <span className="ub-kpi-strip-label">Paid</span>
          </div>
          <div className="ub-kpi-strip-item">
            <span className="ub-kpi-strip-value">{totals.pendingReview}</span>
            <span className="ub-kpi-strip-label">Pending Review</span>
          </div>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: 'var(--ub-ink-faint)' }}>Loading…</p>}

      {!loading && !summaries.length && (
        <div className="ub-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Nothing assigned yet</h3>
          <p style={{ fontSize: 13, color: 'var(--ub-ink-faint)' }}>
            When a committee member assigns you to manage reimbursement for an event — for example, staff competing
            in an external tournament — it will show up here and in My Space, where you can submit bills and track
            them through to payment.
          </p>
        </div>
      )}

      {!loading && summaries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {upcoming && upcoming.event.event_date && (
              <div className="ub-card">
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ub-ink-faint)', marginBottom: 6 }}>NEXT UP</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{upcoming.event.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginTop: 2 }}>
                      {upcoming.event.event_date} · {upcoming.event.venue || 'Venue TBC'}
                    </div>
                  </div>
                  <span className="ub-pill ub-pill-neutral">
                    {daysUntil(upcoming.event.event_date) === 0
                      ? 'Today'
                      : daysUntil(upcoming.event.event_date) > 0
                        ? `In ${daysUntil(upcoming.event.event_date)} day${daysUntil(upcoming.event.event_date) > 1 ? 's' : ''}`
                        : 'In progress'}
                  </span>
                </div>
              </div>
            )}

            <div className="ub-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>My Assigned Events</h3>
              <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginBottom: 12 }}>Approved vs. submitted vs. balance for each event.</p>
              {summaries.map((s) => (
                <Link
                  key={s.event.id}
                  href="/portal"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 4px',
                    borderBottom: '1px solid var(--ub-border-2)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.event.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>
                      Approved {money(s.approvedTotal)} · Submitted {money(s.submittedTotal)}
                    </div>
                  </div>
                  <span className={`ub-pill ${s.balance > 0 ? 'ub-pill-neutral' : 'ub-pill-success'}`}>Balance {money(s.balance)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="ub-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Recent Submissions</h3>
              <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginBottom: 12 }}>Your bill submissions and their status.</p>
              {!recentBatches.length && <p className="ub-empty">No bills submitted yet.</p>}
              {recentBatches.map((b) => {
                const c = cases.find((cs) => cs.id === b.reimbursement_id);
                return (
                  <Link
                    key={b.id}
                    href="/portal"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 4px',
                      borderBottom: '1px solid var(--ub-border-2)',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c?.expense_item || b.submission_ref}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)' }}>{c?.event_name || 'Event'}</div>
                    </div>
                    <span
                      className={`ub-pill ${
                        b.pending_review
                          ? b.return_reason
                            ? 'ub-pill-danger'
                            : 'ub-pill-warning'
                          : b.status === 'Paid'
                            ? 'ub-pill-success'
                            : b.status === 'Returned / Query'
                              ? 'ub-pill-danger'
                              : 'ub-pill-neutral'
                      }`}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {b.pending_review ? (b.return_reason ? 'Returned — Needs Changes' : 'Pending Review') : b.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
