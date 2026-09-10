'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { notifyExpenseApprover, notifyExpenseDecision } from './emailNotifications';
import type { ExpenseRequestWithLines } from './types';
import { cancelRequest, finalDecision, presidentDecision, requestReversal } from './useFinance';

interface Props {
  request: ExpenseRequestWithLines | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function RequestDetailModal({ request, onClose, onRefresh }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (!request) return null;

  const actorEmail = (profile?.email || '').toLowerCase().trim();
  const actorName = (profile?.full_name || '').toLowerCase().trim();
  const isPresident = profile?.role === 'President';
  const selectedEmail = (request.final_approver_email || '').toLowerCase().trim();
  const isSelectedFinalApprover = selectedEmail
    ? actorEmail === selectedEmail
    : (request.final_approver_name || '').toLowerCase().trim() === actorName;

  const act = async (fn: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await fn();
      await onRefresh();
      toast(success);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handlePresidentDecision = async (decision: 'recommend' | 'reject') => {
    await presidentDecision(request, decision, comment, profile?.full_name || '', profile?.role || '');
    try {
      if (decision === 'recommend') {
        await notifyExpenseApprover(request, request.final_approver_email || '', request.final_approver_name || '', 'Final Approval');
      } else {
        await notifyExpenseDecision(request, 'Rejected', comment, profile?.full_name || '', profile?.role || '');
      }
    } catch (err) {
      console.error('Expense approval email failed', err);
    }
  };

  const handleFinalDecision = async (decision: 'approve' | 'reject') => {
    await finalDecision(request, decision, comment, profile?.full_name || '', profile?.role || '');
    try {
      await notifyExpenseDecision(request, decision === 'approve' ? 'Approved' : 'Rejected', comment, profile?.full_name || '', profile?.role || '');
    } catch (err) {
      console.error('Expense decision email failed', err);
    }
  };

  return (
    <Modal open onClose={onClose} title={request.title || request.request_number || 'Expense Request'} wide>
      <div className="mini-stat">
        <div className="mini">
          <small>Status</small>
          <strong>{request.status}</strong>
        </div>
        <div className="mini">
          <small>Subtotal</small>
          <strong>{request.subtotal.toLocaleString()}</strong>
        </div>
        <div className="mini">
          <small>Total (incl. contingency)</small>
          <strong>{request.total_amount.toLocaleString()}</strong>
        </div>
      </div>

      <p style={{ marginTop: 12, fontSize: 13 }}>
        <b>Event:</b> {request.event_name || '—'} &nbsp; <b>Category:</b> {request.category || '—'} &nbsp; <b>Date:</b> {request.request_date || '—'}
      </p>
      <p style={{ fontSize: 13 }}>{request.purpose}</p>

      {request.planned_event_budget > 0 && (
        <div className={request.over_budget ? 'audit-warning' : 'audit-success'}>
          {request.over_budget ? (
            <>
              <b>⚠ Over Budget</b>
              <br />
              This request exceeds the event&apos;s original planned budget by <b>MVR {request.overrun_amount.toLocaleString()}</b>.
              <br />
              <b>Inputter justification:</b> {request.overrun_justification || '—'}
              <br />
              The event planned budget remains unchanged.
            </>
          ) : (
            "This request is within the event's planned budget."
          )}
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Total</th>
            <th>Vendor</th>
            <th>Reimb.</th>
          </tr>
        </thead>
        <tbody>
          {request.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td>{line.quantity}</td>
              <td>{line.rate.toLocaleString()}</td>
              <td>{line.line_total.toLocaleString()}</td>
              <td>{line.vendor || '—'}</td>
              <td>{line.reimbursement_required ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="committee-detail-list" style={{ marginTop: 14 }}>
        <div className="committee-detail-row">
          <small>Requested By</small>
          <strong>
            {request.requested_by} ({request.requester_role})
          </strong>
        </div>
        <div className="committee-detail-row">
          <small>Final Approver</small>
          <strong>
            {request.final_approver_name} ({request.final_approver_role})
          </strong>
        </div>
        {request.president_comment && (
          <div className="committee-detail-row">
            <small>President Comment</small>
            <strong>{request.president_comment}</strong>
          </div>
        )}
        {request.final_approver_comment && (
          <div className="committee-detail-row">
            <small>Final Approver Comment</small>
            <strong>{request.final_approver_comment}</strong>
          </div>
        )}
      </div>

      {(request.status === 'Pending President Recommendation' || request.status === 'Pending Final Approval') && (
        <div className="field full" style={{ marginTop: 16 }}>
          <label>Comment</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      )}

      <div className="modal-actions">
        {request.status === 'Draft' && (
          <button className="btn danger" disabled={busy} onClick={() => void act(() => cancelRequest(request.id), 'Request cancelled')}>
            Cancel Request
          </button>
        )}

        {request.status === 'Pending President Recommendation' && isPresident && (
          <>
            <button className="btn danger" disabled={busy} onClick={() => void act(() => handlePresidentDecision('reject'), 'Request rejected')}>
              Reject
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void act(() => handlePresidentDecision('recommend'), 'Recommended for final approval')}
            >
              Recommend
            </button>
          </>
        )}

        {request.status === 'Pending Final Approval' && isSelectedFinalApprover && (
          <>
            <button className="btn danger" disabled={busy} onClick={() => void act(() => handleFinalDecision('reject'), 'Request rejected')}>
              Reject
            </button>
            <button className="btn primary" disabled={busy} onClick={() => void act(() => handleFinalDecision('approve'), 'Request approved')}>
              Approve
            </button>
          </>
        )}

        {request.status === 'Approved' && !request.reversal_status && (
          <button
            className="btn ghost"
            disabled={busy}
            onClick={() => {
              const reason = prompt('Reason for reversal:');
              if (!reason) return;
              void act(
                () => requestReversal(request.id, reason, profile?.full_name || '', profile?.id || ''),
                'Reversal requested'
              );
            }}
          >
            Request Reversal
          </button>
        )}
      </div>
    </Modal>
  );
}
