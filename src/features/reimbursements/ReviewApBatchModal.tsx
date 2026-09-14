'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { evidenceUrl } from './storage';
import type { AttachmentMode } from './types';
import type { ApBatchWithBills, ProcurementGroupCase } from './types';
import { approveAndSendApBatch, returnApBatchToManager } from './useReimbursements';

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function isPdf(type: string | null | undefined, path: string | null | undefined): boolean {
  return (type || '').toLowerCase().includes('pdf') || (path || '').toLowerCase().endsWith('.pdf');
}
function isImage(type: string | null | undefined, path: string | null | undefined): boolean {
  return (type || '').toLowerCase().startsWith('image') || /\.(png|jpe?g)$/i.test(path || '');
}

function AttachmentPreview({ path, name, type }: { path: string; name: string | null; type: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    void evidenceUrl(path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) return <p style={{ fontSize: 12, color: 'var(--ub-ink-faint)' }}>Loading preview…</p>;

  return (
    <div>
      {isPdf(type, path) && (
        <iframe src={url} title={name || 'Attachment'} style={{ width: '100%', height: 420, border: '1px solid var(--ub-border)', borderRadius: 10 }} />
      )}
      {isImage(type, path) && !isPdf(type, path) && (
        <img src={url} alt={name || 'Attachment'} style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid var(--ub-border)' }} />
      )}
      <div style={{ marginTop: 6 }}>
        <a href={url} target="_blank" rel="noreferrer" className="ub-btn ub-btn-ghost" style={{ fontSize: 12, padding: '5px 10px', display: 'inline-flex' }}>
          Open {name || 'attachment'} in new tab
        </a>
      </div>
    </div>
  );
}

interface Props {
  batch: ApBatchWithBills | null;
  caseItem: ProcurementGroupCase | null;
  onClose: () => void;
  onDecided: () => Promise<void>;
}

export function ReviewApBatchModal({ batch, caseItem, onClose, onDecided }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [apEmail, setApEmail] = useState('');
  const [returning, setReturning] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setApEmail(batch?.ap_email ?? '');
    setReturning(false);
    setReturnReason('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.id]);

  if (!batch || !caseItem) return null;

  const attachmentMode: AttachmentMode = batch.bills_attachment_path ? 'Combined' : 'Individual';
  const billsTotal = batch.bills.reduce((s, b) => s + b.amount, 0);
  const actorName = profile?.full_name || profile?.email || 'Unknown';
  const actorRole = profile?.role || '';

  const handleApproveAndSend = async () => {
    if (!apEmail.trim()) {
      setError('Enter the Accounts Payable email address before sending.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await approveAndSendApBatch(batch, caseItem, apEmail.trim(), attachmentMode, actorName, actorRole);
      toast('Approved and sent to Accounts Payable');
      await onDecided();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve and send.');
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async () => {
    if (!returnReason.trim()) {
      setError('Add a reason so the Manager knows what to fix.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await returnApBatchToManager(batch.id, actorName, returnReason.trim());
      toast('Returned to the Reimbursement Manager');
      await onDecided();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to return submission.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Review Submission — ${caseItem.expense_item}`} wide>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--ub-ink-faint)', marginBottom: 14 }}>
        <span>Case {caseItem.case_ref}</span>
        <span>{caseItem.event_name || 'General Expense'}</span>
        <span>Approved MVR {money(caseItem.approved_item_amount)}</span>
        {batch.manager_submitted_by && (
          <span>
            Submitted by {batch.manager_submitted_by}
            {batch.manager_submitted_at ? ` · ${new Date(batch.manager_submitted_at).toLocaleString()}` : ''}
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table className="ub-table">
          <thead>
            <tr>
              <th>Bill Date</th>
              <th>Vendor</th>
              <th>Worker ID</th>
              <th>Amount</th>
              {attachmentMode === 'Individual' && <th>Attachment</th>}
            </tr>
          </thead>
          <tbody>
            {batch.bills.map((bill) => {
              const billPath = (bill.data as { attachmentPath?: string } | null)?.attachmentPath;
              const billName = (bill.data as { attachmentName?: string } | null)?.attachmentName;
              return (
                <tr key={bill.id}>
                  <td>{bill.bill_date || '—'}</td>
                  <td>{bill.vendor_name || '—'}</td>
                  <td>{bill.worker_id || '—'}</td>
                  <td>MVR {money(bill.amount)}</td>
                  {attachmentMode === 'Individual' && (
                    <td>{billPath ? <AttachmentPreview path={billPath} name={billName ?? null} type={null} /> : '—'}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={3}>Total</td>
              <td colSpan={attachmentMode === 'Individual' ? 2 : 1}>MVR {money(billsTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {attachmentMode === 'Combined' && batch.bills_attachment_path && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Bills Attachment</div>
          <AttachmentPreview path={batch.bills_attachment_path} name={batch.bills_attachment_name} type={batch.bills_attachment_type} />
        </div>
      )}
      {attachmentMode === 'Combined' && !batch.bills_attachment_path && (
        <p style={{ fontSize: 12.5, color: 'var(--ub-danger)', marginBottom: 16 }}>No bills attachment was uploaded.</p>
      )}

      {!returning && (
        <div className="ub-field" style={{ marginBottom: 4 }}>
          <label>Accounts Payable Email</label>
          <input type="email" value={apEmail} onChange={(e) => setApEmail(e.target.value)} placeholder="ap@example.com" />
        </div>
      )}

      {returning && (
        <div className="ub-field" style={{ marginTop: 4 }}>
          <label>Reason for returning to the Manager</label>
          <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="e.g. Missing invoice for Water bill, please attach and resubmit." />
        </div>
      )}

      {error && <div style={{ color: 'var(--ub-danger, #dc2626)', marginTop: 12, fontSize: 13 }}>{error}</div>}

      <div className="modal-actions">
        <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        {!returning && (
          <button className="ub-btn ub-btn-danger" onClick={() => setReturning(true)} disabled={busy}>
            Return to Manager
          </button>
        )}
        {returning && (
          <button className="ub-btn ub-btn-danger" onClick={() => void handleReturn()} disabled={busy}>
            {busy ? 'Returning…' : 'Confirm Return'}
          </button>
        )}
        {!returning && (
          <button className="ub-btn ub-btn-primary" onClick={() => void handleApproveAndSend()} disabled={busy}>
            {busy ? 'Sending…' : 'Approve & Send to AP'}
          </button>
        )}
      </div>
    </Modal>
  );
}
