'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { VendorMasterRow } from '../../types/database';
import { decideExternalReimbursement, usePendingExternalReimbursements } from '../portal/usePortal';
import { ApBatchModal } from './ApBatchModal';
import { ApStatusModal } from './ApStatusModal';
import { ExceptionModal } from './ExceptionModal';
import { ProcurementGroupModal } from './ProcurementGroupModal';
import { ProcurementResponseModal } from './ProcurementResponseModal';
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

type SubTab = 'cases' | 'procurement' | 'ap' | 'exceptions' | 'external' | 'vendors';

const VENDOR_MANAGER_ROLES = ['treasurer', 'president', 'chairperson', 'vice chairperson', 'vice_chairperson', 'secretary'];

function canManageVendors(role: string | undefined): boolean {
  return !!role && VENDOR_MANAGER_ROLES.includes(role.trim().toLowerCase());
}

export function ReimbursementsPage() {
  const { profile } = useAuth();
  const { cases, batches, loading, error, reload } = useReimbursementCases();
  const { eligible, loading: eligibleLoading } = useEligibleExpenseRequests(cases);
  const { items: pendingExternal, loading: externalLoading, reload: reloadExternal } = usePendingExternalReimbursements();
  const { vendors, loading: vendorsLoading, reload: reloadVendors } = useVendorMaster();
  const toast = useToast();

  const [subTab, setSubTab] = useState<SubTab>('cases');
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
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
        <button className={`tab ${subTab === 'vendors' ? 'active' : ''}`} onClick={() => setSubTab('vendors')}>
          Vendors ({vendors.length})
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
