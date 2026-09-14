'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { ApBatchModal } from '../reimbursements/ApBatchModal';
import type { ApBatchWithBills, ProcurementGroupCase } from '../reimbursements/types';
import { latestBatchForCase, managerSubmittedTotal, useStaffReimbursementWorkspace, type ManagedEventSummary } from './useStaffReimbursements';

function money(n: number): string {
  return `MVR ${Math.round(n).toLocaleString()}`;
}

function CaseRow({
  caseItem,
  batches,
  onOpen,
}: {
  caseItem: ProcurementGroupCase;
  batches: ApBatchWithBills[];
  onOpen: (c: ProcurementGroupCase, b: ApBatchWithBills | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const submitted = managerSubmittedTotal(batches, caseItem.id);
  const remaining = caseItem.approved_item_amount - submitted;
  const batch = latestBatchForCase(batches, caseItem.id);

  let statusLabel = 'Ready to submit';
  let pillClass = 'ub-pill-neutral';
  let actionLabel: string | null = 'Submit Bill';
  let openBatch: ApBatchWithBills | null = null;

  if (batch) {
    openBatch = batch;
    if (batch.pending_review) {
      statusLabel = 'Pending Committee Review';
      pillClass = 'ub-pill-warning';
      actionLabel = 'Edit Submission';
    } else if (batch.status === 'Draft') {
      statusLabel = 'Reviewed — Awaiting AP';
      pillClass = 'ub-pill-success';
      actionLabel = 'View';
    } else {
      statusLabel = batch.status;
      pillClass = batch.status === 'Paid' ? 'ub-pill-success' : batch.status === 'Returned / Query' ? 'ub-pill-danger' : 'ub-pill-neutral';
      actionLabel = 'View';
    }
  } else if (remaining <= 0.01) {
    statusLabel = 'Fully submitted';
    pillClass = 'ub-pill-success';
    actionLabel = null;
  }

  return (
    <div style={{ borderBottom: '1px solid var(--ub-border-2)' }}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          padding: '10px 4px',
          cursor: 'pointer',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'var(--ub-ink-faint)' }}>
            ▸
          </span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{caseItem.expense_item}</div>
            <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>
              Approved {money(caseItem.approved_item_amount)} · Submitted {money(submitted)} · Balance {money(remaining)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <span className={`ub-pill ${pillClass}`} style={{ whiteSpace: 'nowrap' }}>
            {statusLabel}
          </span>
          {actionLabel && (
            <button
              className="ub-btn ub-btn-ghost"
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(caseItem, openBatch);
              }}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 4px 14px 26px' }}>
          <div
            style={{
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
              fontSize: 12,
              padding: '10px 12px',
              background: 'var(--ub-surface-2)',
              borderRadius: 10,
              marginBottom: 10,
            }}
          >
            <span>
              <b>{money(caseItem.approved_item_amount)}</b> approved
            </span>
            <span>
              <b>{money(submitted)}</b> submitted
            </span>
            <span style={{ color: remaining < 0 ? 'var(--ub-danger)' : undefined }}>
              <b>{money(remaining)}</b> balance remaining
            </span>
          </div>

          {batch?.status_remarks && (
            <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginBottom: 10 }}>Committee remarks: {batch.status_remarks}</div>
          )}

          {!batch?.bills.length && <p className="ub-empty" style={{ padding: '14px 0' }}>No bills submitted yet.</p>}

          {!!batch?.bills.length && (
            <table className="ub-table" style={{ fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Bill Date</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {batch.bills.map((bill) => (
                  <tr key={bill.id}>
                    <td>{bill.bill_date || '—'}</td>
                    <td>{bill.vendor_name || '—'}</td>
                    <td>{money(bill.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={2}>Total</td>
                  <td>{money(batch.bills.reduce((s, b) => s + b.amount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({
  summary,
  batches,
  onOpenCase,
}: {
  summary: ManagedEventSummary;
  batches: ApBatchWithBills[];
  onOpenCase: (c: ProcurementGroupCase, b: ApBatchWithBills | null) => void;
}) {
  const { event, cases, eligible, approvedTotal, submittedTotal, paidTotal, balance } = summary;

  return (
    <div className="ub-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--ub-ink-faint)', textTransform: 'uppercase', fontWeight: 700 }}>
            {event.event_type || 'Event'} · {event.event_scope || 'Internal'}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0' }}>{event.name}</h3>
          <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>
            {event.event_date || 'Date TBC'} · {event.venue || 'Venue TBC'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Approved</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{money(approvedTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Submitted</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{money(submittedTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Paid</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{money(paidTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', textTransform: 'uppercase' }}>Balance</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: balance < 0 ? 'var(--ub-danger)' : undefined }}>{money(balance)}</div>
        </div>
      </div>

      {!cases.length && !eligible.length && <p className="ub-empty">No approved expense items for this event yet.</p>}

      {cases.map((c) => (
        <CaseRow key={c.id} caseItem={c} batches={batches} onOpen={onOpenCase} />
      ))}

      {eligible.flatMap((r) => r.lines).map((line) => (
        <div
          key={`${line.expenseRequestId}:${line.lineNo}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--ub-border-2)' }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{line.description}</div>
            <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>Approved {money(line.amount)}</div>
          </div>
          <span className="ub-pill ub-pill-neutral">Awaiting Committee Pre-Approval</span>
        </div>
      ))}
    </div>
  );
}

export function StaffPortalPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const { summaries, batches, totals, loading, reload } = useStaffReimbursementWorkspace();
  const [openCase, setOpenCase] = useState<ProcurementGroupCase | null>(null);
  const [openBatch, setOpenBatch] = useState<ApBatchWithBills | null>(null);

  const handleOpenCase = (c: ProcurementGroupCase, b: ApBatchWithBills | null) => {
    setOpenCase(c);
    setOpenBatch(b);
  };

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          background: 'linear-gradient(120deg, var(--ub-ink), var(--ub-accent-dark))',
          color: '#fff',
          padding: '22px 26px',
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 12.5, opacity: 0.85 }}>MY SPACE</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '6px 0' }}>Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h2>
        <p style={{ fontSize: 13.5, opacity: 0.9 }}>
          Manage reimbursement for the event(s) you've been assigned — submit bills and track their status here.
        </p>
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
            <span className="ub-kpi-strip-value">{money(totals.submitted)}</span>
            <span className="ub-kpi-strip-label">Submitted</span>
          </div>
          <div className="ub-kpi-strip-item">
            <span className="ub-kpi-strip-value">{money(totals.balance)}</span>
            <span className="ub-kpi-strip-label">Balance</span>
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
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No assigned events yet</h3>
          <p style={{ fontSize: 13, color: 'var(--ub-ink-faint)' }}>
            You'll see an event here once a committee member assigns you as its Reimbursement Manager — for example,
            when you're organizing UnitedBML staff participation in an external tournament. From there you'll be able
            to view the event's approved expenses, submit bills for reimbursement, and track their status through
            committee review to payment.
          </p>
        </div>
      )}

      {!loading && summaries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {summaries.map((s) => (
            <EventCard key={s.event.id} summary={s} batches={batches} onOpenCase={handleOpenCase} />
          ))}
        </div>
      )}

      <ApBatchModal
        caseItem={openCase}
        existingBatch={openBatch}
        batches={batches}
        onClose={() => {
          setOpenCase(null);
          setOpenBatch(null);
        }}
        onSaved={async () => {
          await reload();
          toast('Saved');
        }}
      />
    </div>
  );
}
