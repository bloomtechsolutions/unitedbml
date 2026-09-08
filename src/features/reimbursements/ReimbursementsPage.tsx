'use client';

import { useState } from 'react';
import { useToast } from '../../lib/ToastContext';
import { decideExternalReimbursement, usePendingExternalReimbursements } from '../portal/usePortal';
import { ApBatchModal } from './ApBatchModal';
import { ApStatusModal } from './ApStatusModal';
import { ExceptionModal } from './ExceptionModal';
import { ProcurementGroupModal } from './ProcurementGroupModal';
import { ProcurementResponseModal } from './ProcurementResponseModal';
import type { ApBatchWithBills, EligibleExpenseLine, EligibleExpenseRequest, ProcurementGroupCase } from './types';
import { apSubmittedTotal, useEligibleExpenseRequests, useReimbursementCases } from './useReimbursements';

type SubTab = 'cases' | 'procurement' | 'ap' | 'exceptions' | 'external';

export function ReimbursementsPage() {
  const { cases, batches, loading, error, reload } = useReimbursementCases();
  const { eligible, loading: eligibleLoading } = useEligibleExpenseRequests(cases);
  const { items: pendingExternal, loading: externalLoading, reload: reloadExternal } = usePendingExternalReimbursements();
  const toast = useToast();

  const [subTab, setSubTab] = useState<SubTab>('cases');
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [groupTarget, setGroupTarget] = useState<EligibleExpenseRequest | null>(null);
  const [exceptionTarget, setExceptionTarget] = useState<EligibleExpenseLine | null>(null);
  const [respondingGroup, setRespondingGroup] = useState<ProcurementGroupCase | null>(null);
  const [batchCase, setBatchCase] = useState<ProcurementGroupCase | null>(null);
  const [editingBatch, setEditingBatch] = useState<ApBatchWithBills | null>(null);
  const [statusBatch, setStatusBatch] = useState<ApBatchWithBills | null>(null);

  const groups = cases.filter((c) => c.data?.isProcurementGroup);
  const lineCases = cases.filter((c) => !c.data?.isProcurementGroup);
  const awaitingGroups = groups.filter((g) => g.status === 'Awaiting Procurement Response');
  const preApproved = lineCases.filter((c) => c.status === 'Pre-Approved');
  const exceptions = lineCases.filter((c) => c.route === 'Exception');
  const nonCancelledBatches = batches.filter((b) => b.status !== 'Draft' && b.status !== 'Cancelled');
  const paidBatches = batches.filter((b) => b.status === 'Paid');

  const refresh = async () => {
    await reload();
  };

  const decideExternal = async (id: string, approve: boolean) => {
    setDecidingId(id);
    try {
      await decideExternalReimbursement(id, approve);
      toast(approve ? 'Reimbursement approved and released to AP' : 'Reimbursement rejected');
      await reloadExternal();
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to decide reimbursement.');
    } finally {
      setDecidingId(null);
    }
  };

  if (loading || eligibleLoading || externalLoading) return <div>Loading reimbursements…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load reimbursements: {error}</div>;

  return (
    <div>
      <div className="reimb-hero">
        <div>
          <h2>Reimbursements</h2>
          <p>Procurement pre-approval, AP batch submission, and payment status for reimbursable expenses.</p>
        </div>
      </div>

      <div className="reimb-kpis">
        <div className="kpi">
          <div className="lbl">Total Cases</div>
          <strong>{lineCases.length}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Awaiting Procurement</div>
          <strong>{awaitingGroups.length}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Pre-Approved</div>
          <strong>{preApproved.length}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Exceptions</div>
          <strong>{exceptions.length}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Submitted to AP</div>
          <strong>{nonCancelledBatches.length}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Paid</div>
          <strong>{paidBatches.length}</strong>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${subTab === 'cases' ? 'active' : ''}`} onClick={() => setSubTab('cases')}>
          Reimbursement Cases
        </button>
        <button className={`tab ${subTab === 'procurement' ? 'active' : ''}`} onClick={() => setSubTab('procurement')}>
          Procurement ({awaitingGroups.length})
        </button>
        <button className={`tab ${subTab === 'ap' ? 'active' : ''}`} onClick={() => setSubTab('ap')}>
          AP Submissions
        </button>
        <button className={`tab ${subTab === 'exceptions' ? 'active' : ''}`} onClick={() => setSubTab('exceptions')}>
          Exceptions ({exceptions.length})
        </button>
        <button className={`tab ${subTab === 'external' ? 'active' : ''}`} onClick={() => setSubTab('external')}>
          External Officials ({pendingExternal.length})
        </button>
      </div>

      {subTab === 'cases' && (
        <div>
          <h4>Eligible Approved Expense Items</h4>
          {eligible.map((request) => (
            <div key={request.expenseRequestId} className="reimb-card">
              <div className="reimb-card-head">
                <div>
                  <b>{request.title || request.expenseRequestNumber}</b>
                  <div className="reimb-meta">
                    <span>{request.eventName || 'No event'}</span>
                    <span>{request.lines.length} item(s)</span>
                  </div>
                </div>
                <button className="btn primary" onClick={() => setGroupTarget(request)}>
                  Standard Pre-Approval · All Items
                </button>
              </div>
              {request.lines.map((line) => (
                <div key={line.lineNo} className="reimb-flag">
                  <span>{line.description}</span>
                  <span>{line.amount.toLocaleString()}</span>
                  <button className="btn ghost" onClick={() => setExceptionTarget(line)}>
                    No Pre-Approval / Exception
                  </button>
                </div>
              ))}
            </div>
          ))}
          {!eligible.length && <p style={{ color: 'var(--muted)' }}>No approved expense items awaiting reimbursement processing.</p>}

          <h4 style={{ marginTop: 20 }}>Reimbursement Cases</h4>
          <table className="table">
            <thead>
              <tr>
                <th>Case Ref</th>
                <th>Event</th>
                <th>Item</th>
                <th>Approved</th>
                <th>Submitted</th>
                <th>Remaining</th>
                <th>Route</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lineCases.map((c) => {
                const submitted = apSubmittedTotal(batches, c.id);
                return (
                  <tr key={c.id}>
                    <td>{c.case_ref}</td>
                    <td>{c.event_name || '—'}</td>
                    <td>{c.expense_item}</td>
                    <td>{c.approved_item_amount.toLocaleString()}</td>
                    <td>{submitted.toLocaleString()}</td>
                    <td>{(c.approved_item_amount - submitted).toLocaleString()}</td>
                    <td>
                      <span className={`pill ${c.route === 'Exception' ? 'cancel' : 'plan'}`}>{c.route}</span>
                    </td>
                    <td>
                      <span className={`reimb-status ${c.status.replace(/[\s/]/g, '')}`}>{c.status}</span>
                    </td>
                    <td>
                      {(c.status === 'Pre-Approved' || c.status === 'Exception Recorded') && (
                        <button
                          className="btn ghost"
                          onClick={() => {
                            setBatchCase(c);
                            setEditingBatch(null);
                          }}
                        >
                          + AP Batch
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!lineCases.length && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No reimbursement cases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'procurement' && (
        <div>
          {groups.map((g) => (
            <div key={g.id} className="reimb-card">
              <div className="reimb-card-head">
                <div>
                  <b>{g.case_ref}</b>
                  <div className="reimb-meta">
                    <span>{g.event_name || 'No event'}</span>
                    <span>{g.expense_request_number}</span>
                    <span>{g.approved_item_amount.toLocaleString()}</span>
                  </div>
                </div>
                <span className={`reimb-status ${g.status.replace(/[\s/]/g, '')}`}>{g.status}</span>
              </div>
              <ul>
                {g.items.map((item) => (
                  <li key={item.lineNo} style={{ fontSize: 12 }}>
                    {item.description} — {item.amount.toLocaleString()}
                  </li>
                ))}
              </ul>
              {g.status === 'Awaiting Procurement Response' && (
                <button className="btn primary" onClick={() => setRespondingGroup(g)}>
                  Record Procurement Response
                </button>
              )}
            </div>
          ))}
          {!groups.length && <p style={{ color: 'var(--muted)' }}>No Procurement pre-approvals yet.</p>}
        </div>
      )}

      {subTab === 'ap' && (
        <table className="table">
          <thead>
            <tr>
              <th>AP Ref</th>
              <th>Case</th>
              <th>Bills</th>
              <th>Amount</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {batches
              .filter((b) => b.status !== 'Cancelled')
              .map((b) => (
                <tr key={b.id}>
                  <td>{b.submission_ref}</td>
                  <td>{lineCases.find((c) => c.id === b.reimbursement_id)?.case_ref || b.reimbursement_id}</td>
                  <td>{b.bills.length}</td>
                  <td>{b.bills.reduce((sum, bill) => sum + bill.amount, 0).toLocaleString()}</td>
                  <td>
                    <span className={`ap-status ${b.status.replace(/[\s/]/g, '')}`}>{b.status}</span>
                    {b.status_remarks && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{b.status_remarks}</div>}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {b.status === 'Draft' && (
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setBatchCase(lineCases.find((c) => c.id === b.reimbursement_id) ?? null);
                          setEditingBatch(b);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {b.status !== 'Draft' && (
                      <button className="btn ghost" onClick={() => setStatusBatch(b)}>
                        Update Status
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            {!batches.filter((b) => b.status !== 'Cancelled').length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No AP batches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {subTab === 'exceptions' && (
        <table className="table">
          <thead>
            <tr>
              <th>Case Ref</th>
              <th>Item</th>
              <th>Reason</th>
              <th>Remarks</th>
              <th>Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((c) => (
              <tr key={c.id}>
                <td>{c.case_ref}</td>
                <td>{c.expense_item}</td>
                <td>{c.exception_reason}</td>
                <td>{c.exception_remarks || '—'}</td>
                <td>{c.recorded_by}</td>
              </tr>
            ))}
            {!exceptions.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No exceptions recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {subTab === 'external' && (
        <div>
          {pendingExternal.map((r) => (
            <div className="external-approval-row" key={r.id}>
              <div>
                <b>{r.title}</b>
                <small>
                  {r.vendor_name || 'No vendor'} · {r.expense_date} · {r.reference_no || 'No reference'}
                </small>
              </div>
              <div>${r.amount.toFixed(2)}</div>
              <div>{r.official_role || 'Official'}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn ghost" disabled={decidingId === r.id} onClick={() => void decideExternal(r.id, false)}>
                  Reject
                </button>
                <button className="btn primary" disabled={decidingId === r.id} onClick={() => void decideExternal(r.id, true)}>
                  Approve
                </button>
              </div>
            </div>
          ))}
          {!pendingExternal.length && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>
              No External Event Official reimbursements awaiting approval.
            </div>
          )}
        </div>
      )}

      <ProcurementGroupModal
        request={groupTarget}
        onClose={() => setGroupTarget(null)}
        onCreated={async () => {
          await refresh();
          toast('Sent for Procurement pre-approval');
        }}
      />
      <ExceptionModal
        line={exceptionTarget}
        onClose={() => setExceptionTarget(null)}
        onCreated={async () => {
          await refresh();
          toast('Exception recorded');
        }}
      />
      <ProcurementResponseModal
        group={respondingGroup}
        onClose={() => setRespondingGroup(null)}
        onSaved={async () => {
          await refresh();
          toast('Procurement response recorded');
        }}
      />
      <ApBatchModal
        caseItem={batchCase}
        existingBatch={editingBatch}
        batches={batches}
        onClose={() => {
          setBatchCase(null);
          setEditingBatch(null);
        }}
        onSaved={async () => {
          await refresh();
          toast('AP batch saved');
        }}
      />
      <ApStatusModal
        batch={statusBatch}
        onClose={() => setStatusBatch(null)}
        onSaved={async () => {
          await refresh();
          toast('AP status updated');
        }}
      />
    </div>
  );
}
