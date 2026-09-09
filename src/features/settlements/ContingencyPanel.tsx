'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { outlookEmailTemplate, sendEmail } from '../../lib/email';
import type { ContingencyRequestRow } from '../../types/database';
import { CONTINGENCY_STATUSES } from './types';
import { decideContingencyProcurement, markContingencyProcurementSent, recommendContingency, useContingencyRequests } from './useSettlements';

function statusPill(status: string): string {
  if (status === 'Approved') return 'ub-pill-success';
  if (status === 'Rejected') return 'ub-pill-danger';
  return 'ub-pill-warning';
}

function PresidentRecommendModal({ request, onClose, onDone }: { request: ContingencyRequestRow | null; onClose: () => void; onDone: () => Promise<void> }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [procurementEmail, setProcurementEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!request) return null;

  const actorName = profile?.full_name || profile?.email || 'Unknown';

  const alreadyRecommended = request.status === 'Pending Procurement Pre-Approval';

  const decide = async (decision: 'Approve' | 'Reject') => {
    if (decision === 'Approve' && !procurementEmail.trim()) {
      setError('Enter Procurement Manager email to notify on recommendation.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!alreadyRecommended) await recommendContingency(request, decision, comment, actorName);
      if (decision === 'Approve') {
        const subject = `Contingency Pre-Approval Required: ${request.ref} - ${request.expense_item}`;
        try {
          const html = outlookEmailTemplate({
            heading: 'Contingency Use Request',
            intro: `Dear Sir, the President has recommended releasing additional contingency for the following expense item. Please review and confirm.`,
            rows: [
              { label: 'Expense Request', value: request.expense_request_number ?? '' },
              { label: 'Event / Activity', value: request.event_name || 'General (no linked event)' },
              { label: 'Expense Item', value: request.expense_item },
            ],
            totalLabel: 'Requested Amount',
            totalValue: `MVR ${request.requested_amount.toLocaleString()}`,
            boxedNote: { label: 'Reason', value: request.reason },
            signatureName: actorName,
            signatureRole: profile?.role || '',
            signatureEmail: profile?.email || '',
          });
          await sendEmail({
            to: procurementEmail.trim(),
            subject,
            html,
            emailType: 'Contingency Pre-Approval',
            relatedType: 'contingency_request',
            relatedId: request.id,
          });
          await markContingencyProcurementSent(request, procurementEmail.trim(), subject);
        } catch (emailErr) {
          setError(
            `Recommendation saved, but the Procurement email failed to send: ${emailErr instanceof Error ? emailErr.message : 'Unknown error'}. Retry from the Contingency tab.`
          );
          setSaving(false);
          await onDone();
          return;
        }
      }
      toast(decision === 'Approve' ? 'Recommended and Procurement notified' : 'Contingency request rejected');
      await onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record recommendation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={alreadyRecommended ? `Resend to Procurement — ${request.ref}` : `President Recommendation — ${request.ref}`}>
      <p style={{ fontSize: 12, color: 'var(--ub-ink-faint, #6b7280)' }}>
        {request.expense_item} · MVR {request.requested_amount.toLocaleString()} · {request.reason}
      </p>
      <div className="ub-field" style={{ marginBottom: 12 }}>
        <label>Procurement Manager Email (required to send)</label>
        <input type="email" value={procurementEmail} onChange={(e) => setProcurementEmail(e.target.value)} />
      </div>
      {!alreadyRecommended && (
        <div className="ub-field">
          <label>Comment (required to reject)</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      )}
      {error && <div style={{ color: 'var(--ub-danger, #dc2626)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        {!alreadyRecommended && (
          <button className="ub-btn ub-btn-danger" onClick={() => void decide('Reject')} disabled={saving}>
            Reject
          </button>
        )}
        <button className="ub-btn ub-btn-primary" onClick={() => void decide('Approve')} disabled={saving}>
          {saving ? 'Sending…' : alreadyRecommended ? 'Send to Procurement' : 'Recommend & Notify Procurement'}
        </button>
      </div>
    </Modal>
  );
}

function ProcurementDecisionModal({ request, onClose, onDone }: { request: ContingencyRequestRow | null; onClose: () => void; onDone: () => Promise<void> }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [releasedAmount, setReleasedAmount] = useState(request?.requested_amount ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!request) return null;

  const actorName = profile?.full_name || profile?.email || 'Unknown';

  const decide = async (decision: 'Approved' | 'Rejected') => {
    setSaving(true);
    setError(null);
    try {
      await decideContingencyProcurement(request, decision, releasedAmount, actorName);
      toast(decision === 'Approved' ? 'Contingency released' : 'Contingency request rejected');
      await onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record Procurement decision.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Procurement Decision — ${request.ref}`}>
      <p style={{ fontSize: 12, color: 'var(--ub-ink-faint, #6b7280)' }}>
        {request.expense_item} · Requested MVR {request.requested_amount.toLocaleString()}
      </p>
      <div className="ub-field">
        <label>Released Amount (MVR)</label>
        <input type="number" min={0} max={request.requested_amount} value={releasedAmount} onChange={(e) => setReleasedAmount(Number(e.target.value))} />
      </div>
      {error && <div style={{ color: 'var(--ub-danger, #dc2626)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="ub-btn ub-btn-danger" onClick={() => void decide('Rejected')} disabled={saving}>
          Reject
        </button>
        <button className="ub-btn ub-btn-primary" onClick={() => void decide('Approved')} disabled={saving}>
          {saving ? 'Saving…' : 'Approve & Release'}
        </button>
      </div>
    </Modal>
  );
}

export function ContingencyPanel() {
  const { profile } = useAuth();
  const { requests, loading, reload } = useContingencyRequests();
  const [recommendTarget, setRecommendTarget] = useState<ContingencyRequestRow | null>(null);
  const [procurementTarget, setProcurementTarget] = useState<ContingencyRequestRow | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const isPresident = profile?.role === 'President';

  const filtered = requests.filter((r) => !statusFilter || r.status === statusFilter);

  if (loading) return <div>Loading contingency requests…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint, #6b7280)' }}>
          Requester → President recommendation → Procurement pre-approval → Approved/Released or Rejected. Capped at each request&apos;s fixed
          5% reserve.
        </p>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All Statuses</option>
          {CONTINGENCY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <table className="ub-table">
        <thead>
          <tr>
            <th>Ref</th>
            <th>Item</th>
            <th>Requested</th>
            <th>Released</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td>{r.ref}</td>
              <td>
                {r.expense_item}
                <div style={{ fontSize: 11, color: 'var(--ub-ink-faint, #6b7280)' }}>
                  {r.event_name || 'General'} · {r.expense_request_number}
                </div>
              </td>
              <td>{r.requested_amount.toLocaleString()}</td>
              <td>{r.released_amount ? r.released_amount.toLocaleString() : '—'}</td>
              <td>
                <span className={`ub-pill ${statusPill(r.status)}`}>{r.status}</span>
              </td>
              <td>
                {r.status === 'Pending President Recommendation' && isPresident && (
                  <button className="ub-btn ub-btn-primary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setRecommendTarget(r)}>
                    Recommend
                  </button>
                )}
                {r.status === 'Pending Procurement Pre-Approval' && (
                  <button className="ub-btn ub-btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setRecommendTarget(r)}>
                    Retry Send
                  </button>
                )}
                {r.status === 'Awaiting Procurement Response' && (
                  <button className="ub-btn ub-btn-primary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setProcurementTarget(r)}>
                    Record Decision
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!filtered.length && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ub-ink-faint, #6b7280)' }}>
                No contingency requests.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <PresidentRecommendModal request={recommendTarget} onClose={() => setRecommendTarget(null)} onDone={reload} />
      <ProcurementDecisionModal request={procurementTarget} onClose={() => setProcurementTarget(null)} onDone={reload} />
    </div>
  );
}
