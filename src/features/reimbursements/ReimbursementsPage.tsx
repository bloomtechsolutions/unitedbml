'use client';

import { useMemo, useState } from 'react';
import { PageInfoPanel } from '../../components/PageInfoPanel';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { VendorMasterRow } from '../../types/database';
import { ApBatchModal } from './ApBatchModal';
import { ApStatusModal } from './ApStatusModal';
import { ExceptionModal } from './ExceptionModal';
import { ProcurementGroupModal } from './ProcurementGroupModal';
import { ProcurementResponseModal } from './ProcurementResponseModal';
import { ReviewApBatchModal } from './ReviewApBatchModal';
import { VendorFormModal } from './VendorFormModal';
import { VendorImportModal } from './VendorImportModal';
import type { ApBatchWithBills, EligibleExpenseLine, EligibleExpenseRequest, ProcurementGroupCase } from './types';
import {
  apSubmittedTotal,
  deleteVendor,
  sendProcurementGroupEmail,
  useEligibleExpenseRequests,
  useReimbursementCases,
  useVendorMaster,
} from './useReimbursements';

type SubTab = 'cases' | 'procurement' | 'ap' | 'exceptions' | 'vendors' | 'info';

const REIMBURSEMENTS_INFO = [
  {
    q: 'What are "Eligible Approved Expense Items"?',
    a: "Expense lines already approved in Finance and flagged for reimbursement, but not yet routed into a reimbursement case. From here you either send them for Standard Procurement pre-approval, or record them directly as a No Pre-Approval / Exception case if they were already paid or don't need pre-approval. Nothing here is awaiting approval — approval already happened in Finance; this is only about routing.",
  },
  {
    q: 'What is a Reimbursement Case?',
    a: 'A case tracks one approved expense item through to payment: its approved amount, how much has been submitted so far, and what remains. A case must be Pre-Approved (via Procurement) or have an Exception recorded before it can be submitted into an AP Batch.',
  },
  {
    q: 'What happens in the Procurement tab?',
    a: 'Cases sent for Standard Pre-Approval wait here for a Procurement decision. An email is sent to the Procurement contact automatically; once their response is recorded, the case moves to Pre-Approved and becomes eligible for an AP Batch.',
  },
  {
    q: 'How does an AP Submission get reviewed and sent?',
    a: 'A Reimbursement Manager (or committee member) drafts a batch of bills against a case. A committee member opens it from AP Submissions, reviews each bill and its attached receipt inline (no download needed), then either Approves & Sends to Accounts Payable by email, or Returns it to the submitter with a required reason. A batch can be resubmitted any number of times, but the running total across all submissions for a case can never exceed its approved amount.',
  },
  {
    q: 'What gets emailed to Accounts Payable?',
    a: 'Every approved AP email includes the submitted bills and a signed-off approval note — either the Finance Expense Approval Note (for cases routed through a Finance request) or an AP Submission Approval Note built from the batch\'s own review trail (for cases without one, e.g. externally-run events).',
  },
  {
    q: 'What is an Exception?',
    a: "For an expense item that was already paid, or genuinely doesn't need Procurement pre-approval. Recording one moves the case straight to Exception Recorded, skipping the Procurement tab.",
  },
  {
    q: 'What are Vendors?',
    a: 'The payee directory bills are raised against — account details and status. Only Treasurer, President, Chairperson, Vice Chairperson or Secretary can add or edit vendor records.',
  },
];

const VENDOR_MANAGER_ROLES = ['treasurer', 'president', 'chairperson', 'vice chairperson', 'vice_chairperson', 'secretary'];

function canManageVendors(role: string | undefined): boolean {
  return !!role && VENDOR_MANAGER_ROLES.includes(role.trim().toLowerCase());
}

export function ReimbursementsPage() {
  const { profile } = useAuth();
  const { cases, batches, loading, error, reload } = useReimbursementCases();
  const { eligible, loading: eligibleLoading } = useEligibleExpenseRequests(cases);
  const { vendors, loading: vendorsLoading, reload: reloadVendors } = useVendorMaster();
  const toast = useToast();

  const [subTab, setSubTab] = useState<SubTab>('cases');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [reviewBatch, setReviewBatch] = useState<ApBatchWithBills | null>(null);
  const [groupTarget, setGroupTarget] = useState<EligibleExpenseRequest | null>(null);
  const [exceptionTarget, setExceptionTarget] = useState<EligibleExpenseLine | null>(null);
  const [respondingGroup, setRespondingGroup] = useState<ProcurementGroupCase | null>(null);
  const [batchCase, setBatchCase] = useState<ProcurementGroupCase | null>(null);
  const [editingBatch, setEditingBatch] = useState<ApBatchWithBills | null>(null);
  const [statusBatch, setStatusBatch] = useState<ApBatchWithBills | null>(null);
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorMasterRow | null>(null);
  const [vendorImportOpen, setVendorImportOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');

  const canManageVendorMaster = canManageVendors(profile?.role);
  const filteredVendors = useMemo(
    () =>
      vendors.filter((v) => {
        const q = vendorSearch.toLowerCase();
        return !q || v.name.toLowerCase().includes(q) || v.vendor_account.toLowerCase().includes(q) || (v.worker_id || '').toLowerCase().includes(q);
      }),
    [vendors, vendorSearch]
  );

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

  const resendProcurementEmail = async (group: ProcurementGroupCase) => {
    setResendingId(group.id);
    try {
      await sendProcurementGroupEmail(group, profile?.full_name || profile?.email || 'Unknown', profile?.role || '', profile?.email || '');
      toast('Procurement pre-approval email sent');
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send email.');
    } finally {
      setResendingId(null);
    }
  };

  if (loading || eligibleLoading) return <div>Loading reimbursements…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load reimbursements: {error}</div>;

  return (
    <div>
      <div className="reimb-hero">
        <div>
          <h2>Reimbursements</h2>
        </div>
      </div>

      <div className="ub-kpi-strip">
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{lineCases.length}</span>
          <span className="ub-kpi-strip-label">Total Cases</span>
        </div>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{awaitingGroups.length}</span>
          <span className="ub-kpi-strip-label">Awaiting Procurement</span>
        </div>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{preApproved.length}</span>
          <span className="ub-kpi-strip-label">Pre-Approved</span>
        </div>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{exceptions.length}</span>
          <span className="ub-kpi-strip-label">Exceptions</span>
        </div>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{nonCancelledBatches.length}</span>
          <span className="ub-kpi-strip-label">Submitted to AP</span>
        </div>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{paidBatches.length}</span>
          <span className="ub-kpi-strip-label">Paid</span>
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
        <button className={`tab ${subTab === 'vendors' ? 'active' : ''}`} onClick={() => setSubTab('vendors')}>
          Vendors ({vendors.length})
        </button>
        <button className={`tab ${subTab === 'info' ? 'active' : ''}`} onClick={() => setSubTab('info')}>
          Info
        </button>
      </div>

      {subTab === 'info' && <PageInfoPanel sections={REIMBURSEMENTS_INFO} />}

      {subTab === 'cases' && (
        <div>
          <h4>Eligible Approved Expense Items</h4>
          {eligible.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
              <table className="table" style={{ fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Request / Event</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {eligible.map((request) =>
                    request.lines.map((line, i) => (
                      <tr key={`${request.expenseRequestId}:${line.lineNo}`}>
                        <td>{line.description}</td>
                        <td style={{ color: 'var(--muted)' }}>
                          {request.eventName || 'No event'} · {request.title || request.expenseRequestNumber}
                        </td>
                        <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {i === 0 && (
                            <button className="btn primary" onClick={() => setGroupTarget(request)}>
                              Standard Pre-Approval{request.lines.length > 1 ? ` · All ${request.lines.length} Items` : ''}
                            </button>
                          )}
                          <button className="btn ghost" onClick={() => setExceptionTarget(line)}>
                            Exception
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!eligible.length && <p style={{ color: 'var(--muted)' }}>No approved expense items awaiting reimbursement processing.</p>}

          <h4 style={{ marginTop: 20 }}>Reimbursement Cases</h4>
          <div style={{ overflowX: 'auto' }}>
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
              {g.email_sent_at ? (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                  Emailed to {g.procurement_manager_email} on {new Date(g.email_sent_at).toLocaleString()}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 8 }}>Email not yet sent to Procurement.</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {!g.email_sent_at && (
                  <button className="btn ghost" disabled={resendingId === g.id} onClick={() => void resendProcurementEmail(g)}>
                    {resendingId === g.id ? 'Sending…' : 'Send Email'}
                  </button>
                )}
                {g.status === 'Awaiting Procurement Response' && (
                  <button className="btn primary" onClick={() => setRespondingGroup(g)}>
                    Record Procurement Response
                  </button>
                )}
              </div>
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
                  <td>{cases.find((c) => c.id === b.reimbursement_id)?.case_ref || b.reimbursement_id}</td>
                  <td>{b.bills.length}</td>
                  <td>{b.bills.reduce((sum, bill) => sum + bill.amount, 0).toLocaleString()}</td>
                  <td>
                    <span className={`ap-status ${b.status.replace(/[\s/]/g, '')}`}>{b.status}</span>
                    {b.pending_review && (
                      <div style={{ marginTop: 4 }}>
                        <span className="pill" style={{ background: '#fff4db', color: '#946100' }}>
                          Pending Review{b.manager_submitted_by ? ` · ${b.manager_submitted_by}` : ''}
                        </span>
                      </div>
                    )}
                    {!b.pending_review && b.return_reason && (
                      <div style={{ marginTop: 4 }}>
                        <span className="pill" style={{ background: '#fff0f4', color: '#b43554' }} title={b.return_reason}>
                          Returned to Manager
                        </span>
                      </div>
                    )}
                    {b.status_remarks && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{b.status_remarks}</div>}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {b.status === 'Draft' && (
                      <button
                        className="btn ghost"
                        onClick={() => {
                          const c = cases.find((c) => c.id === b.reimbursement_id);
                          if (!c) {
                            toast(`Case ${b.reimbursement_id} for this batch no longer exists — cannot edit.`);
                            return;
                          }
                          setBatchCase(c);
                          setEditingBatch(b);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {b.pending_review && (
                      <button
                        className="btn primary"
                        onClick={() => {
                          if (!cases.some((c) => c.id === b.reimbursement_id)) {
                            toast(`Case ${b.reimbursement_id} for this batch no longer exists — cannot review.`);
                            return;
                          }
                          setReviewBatch(b);
                        }}
                      >
                        Review
                      </button>
                    )}
                    <button className="btn ghost" onClick={() => setStatusBatch(b)}>
                      Update Status
                    </button>
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

      {subTab === 'vendors' && (
        <div>
          <div className="toolbar">
            <div className="filters">
              <input
                placeholder="Search vendor, account, worker ID…"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
              />
            </div>
            {canManageVendorMaster && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={() => setVendorImportOpen(true)}>
                  Bulk Import (CSV/Excel)
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    setEditingVendor(null);
                    setVendorFormOpen(true);
                  }}
                >
                  + Add Vendor
                </button>
              </div>
            )}
          </div>
          {!canManageVendorMaster && (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Vendors are the staff/payees used when submitting AP bills. Only Treasurer, President,
              Chairperson, Vice Chairperson or Secretary can add or edit vendors.
            </p>
          )}
          {vendorsLoading ? (
            <div>Loading vendors…</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor Account</th>
                  <th>Name</th>
                  <th>Worker ID</th>
                  <th>Status</th>
                  {canManageVendorMaster && <th />}
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((v) => (
                  <tr key={v.vendor_account}>
                    <td>{v.vendor_account}</td>
                    <td>{v.name}</td>
                    <td>{v.worker_id || '—'}</td>
                    <td>
                      <span className={`pill ${v.status === 'Inactive' ? 'cancel' : 'open'}`}>{v.status}</span>
                    </td>
                    {canManageVendorMaster && (
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn ghost"
                          onClick={() => {
                            setEditingVendor(v);
                            setVendorFormOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn danger"
                          onClick={() => {
                            if (!confirm(`Remove vendor "${v.name}"?`)) return;
                            void deleteVendor(v.vendor_account).then(reloadVendors);
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!filteredVendors.length && (
                  <tr>
                    <td colSpan={canManageVendorMaster ? 5 : 4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No vendors match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
      <ReviewApBatchModal
        batch={reviewBatch}
        caseItem={reviewBatch ? cases.find((c) => c.id === reviewBatch.reimbursement_id) ?? null : null}
        onClose={() => setReviewBatch(null)}
        onDecided={refresh}
      />
      <VendorFormModal
        open={vendorFormOpen}
        vendor={editingVendor}
        onClose={() => setVendorFormOpen(false)}
        onSaved={async () => {
          await reloadVendors();
          toast('Vendor saved');
        }}
      />
      <VendorImportModal
        open={vendorImportOpen}
        onClose={() => setVendorImportOpen(false)}
        onImported={reloadVendors}
      />
    </div>
  );
}
