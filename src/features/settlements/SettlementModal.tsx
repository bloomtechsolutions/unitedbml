'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { ContingencyRequestModal } from './ContingencyRequestModal';
import type { ReconciliationLine } from './types';
import { CONTINGENCY_ACTIVE_STATUSES } from './types';
import {
  closeSettlement,
  contingencyAvailableForRequest,
  isGeneralSettlementKey,
  saveSettlementActuals,
  useSettlementDetail,
} from './useSettlements';

type ContingencyTarget = ReconciliationLine & { eventId: string | null; eventName: string | null; available: number };

interface Props {
  settlementKey: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function SettlementModal({ settlementKey, onClose, onChanged }: Props) {
  const { isCommitteeUser } = useAuth();
  const toast = useToast();
  const { entity, lines, contingencyRequests, contingencyAll, requests, loading, reload } = useSettlementDetail(settlementKey);

  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contingencyTarget, setContingencyTarget] = useState<ContingencyTarget | null>(null);

  useEffect(() => {
    if (!settlementKey) return;
    const seed: Record<string, number> = {};
    for (const l of lines) {
      if (l.sourceType === 'Direct Entry') seed[l.sourceKey] = l.actualAmount;
    }
    setDrafts(seed);
    setRemarks((entity as { actual_expense_remarks?: string | null } | null)?.actual_expense_remarks ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementKey, lines.length]);

  const totals = useMemo(() => {
    let approved = 0;
    let actual = 0;
    for (const l of lines) {
      approved += l.approvedAmount;
      actual += l.sourceType === 'Direct Entry' ? drafts[l.sourceKey] ?? l.actualAmount : l.actualAmount;
    }
    return { approved, actual, variance: approved - actual };
  }, [lines, drafts]);

  if (!settlementKey) return null;

  const isGeneral = isGeneralSettlementKey(settlementKey);
  const status = (entity as { finance_settlement_status?: string } | null)?.finance_settlement_status ?? 'Pending Actuals';
  const title = isGeneral
    ? (entity as { title?: string | null; request_number?: string | null } | null)?.title ||
      (entity as { request_number?: string | null } | null)?.request_number ||
      'General Expense Settlement'
    : (entity as { name?: string } | null)?.name || 'Event Settlement';

  const overspend = totals.actual > totals.approved + 0.01;
  const allDirectEntered = lines.filter((l) => l.sourceType === 'Direct Entry').every((l) => drafts[l.sourceKey] !== undefined);
  const allReimbursementSettled = lines.filter((l) => l.sourceType === 'Reimbursement').every((l) => l.settled);
  const hasPendingContingency = contingencyRequests.some((c) => CONTINGENCY_ACTIVE_STATUSES.includes(c.status));

  const handleSave = async () => {
    if (!allDirectEntered) {
      setError('Enter an actual amount for every Direct Entry line before saving.');
      return;
    }
    if (overspend && !remarks.trim()) {
      setError('Actual spend exceeds the approved amount — add settlement remarks explaining the overspend.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveSettlementActuals(
        settlementKey,
        lines.map((l) => ({
          sourceKey: l.sourceKey,
          expenseRequestId: l.expenseRequestId,
          lineIndex: l.lineIndex,
          expenseItem: l.expenseItem,
          approvedAmount: l.approvedAmount,
          actualAmount: l.sourceType === 'Direct Entry' ? drafts[l.sourceKey] ?? 0 : l.actualAmount,
          sourceType: l.sourceType,
          manualEntered: true,
        })),
        remarks
      );
      toast('Settlement actuals saved');
      await Promise.all([reload(), onChanged()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settlement actuals.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!allReimbursementSettled) {
      setError('All reimbursement lines must be settled (AP batch Paid) before closing.');
      return;
    }
    if (hasPendingContingency) {
      setError('Resolve pending contingency requests before closing this settlement.');
      return;
    }
    setClosing(true);
    setError(null);
    try {
      await closeSettlement(settlementKey);
      toast('Settlement closed');
      await Promise.all([reload(), onChanged()]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close settlement.');
    } finally {
      setClosing(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Settlement — ${title}`} wide>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className={`ub-pill ${status === 'Closed' ? 'ub-pill-success' : status === 'Actuals Entered' ? 'ub-pill-warning' : 'ub-pill-neutral'}`}>
          {status}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ub-ink-faint, #6b7280)' }}>{isGeneral ? 'General Expense' : 'Event-linked'}</span>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="ub-table">
              <thead>
                <tr>
                  <th>Expense Item</th>
                  <th>Source</th>
                  <th>Approved</th>
                  <th>Actual</th>
                  <th>Variance</th>
                  <th>Details</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const actualValue = l.sourceType === 'Direct Entry' ? drafts[l.sourceKey] ?? 0 : l.actualAmount;
                  const variance = l.approvedAmount - actualValue;
                  const request = requests.find((r) => r.id === l.expenseRequestId);
                  const available = request ? contingencyAvailableForRequest(contingencyAll, request) : 0;
                  return (
                    <tr key={l.sourceKey}>
                      <td>{l.expenseItem}</td>
                      <td>
                        <span className="ub-pill ub-pill-neutral" style={{ fontSize: 11 }}>
                          {l.sourceType === 'Direct Entry' ? 'Treasurer Entry' : l.sourceType === 'Reimbursement' ? 'Auto · Reimbursement' : 'Budget Reserve'}
                        </span>
                      </td>
                      <td>
                        {l.approvedAmount.toLocaleString()}
                        {l.contingencyAdded > 0 && (
                          <div style={{ fontSize: 10.5, color: 'var(--ub-ink-faint, #6b7280)' }}>
                            {l.originalApprovedAmount.toLocaleString()} + {l.contingencyAdded.toLocaleString()} contingency
                          </div>
                        )}
                      </td>
                      <td>
                        {l.sourceType === 'Direct Entry' ? (
                          <input
                            type="number"
                            min={0}
                            style={{ width: 110 }}
                            value={drafts[l.sourceKey] ?? ''}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [l.sourceKey]: Number(e.target.value) }))}
                            disabled={status === 'Closed'}
                          />
                        ) : (
                          actualValue.toLocaleString()
                        )}
                      </td>
                      <td style={{ color: variance < 0 ? 'var(--ub-danger, #dc2626)' : undefined }}>{variance.toLocaleString()}</td>
                      <td style={{ fontSize: 11, color: 'var(--ub-ink-faint, #6b7280)' }}>
                        {l.sourceType === 'Reimbursement' ? l.reimbursementDetail : l.isContingency ? 'Unused reserve' : ''}
                      </td>
                      <td>
                        {!l.isContingency && status !== 'Closed' && (
                          <button
                            className="ub-btn ub-btn-ghost"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() =>
                              setContingencyTarget({
                                ...l,
                                eventId: isGeneral ? null : settlementKey,
                                eventName: isGeneral ? null : title,
                                available,
                              })
                            }
                          >
                            Request Contingency
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!lines.length && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--ub-ink-faint, #6b7280)' }}>
                      No approved expense items for this settlement.
                    </td>
                  </tr>
                )}
              </tbody>
              {lines.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2}>Total</td>
                    <td>{totals.approved.toLocaleString()}</td>
                    <td>{totals.actual.toLocaleString()}</td>
                    <td style={{ color: totals.variance < 0 ? 'var(--ub-danger, #dc2626)' : undefined }}>{totals.variance.toLocaleString()}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {contingencyRequests.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Contingency Requests</div>
              {contingencyRequests.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--ub-border-2, #f0f0f0)' }}>
                  <span>
                    {c.ref} · {c.expense_item} · MVR {c.requested_amount.toLocaleString()}
                  </span>
                  <span className="ub-pill ub-pill-neutral">{c.status}</span>
                </div>
              ))}
            </div>
          )}

          {overspend && (
            <div className="ub-field" style={{ marginTop: 16 }}>
              <label>Settlement Remarks (required — actual exceeds approved)</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={status === 'Closed'} />
            </div>
          )}
          {!overspend && status !== 'Closed' && (
            <div className="ub-field" style={{ marginTop: 16 }}>
              <label>Settlement Remarks (optional)</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          )}

          {error && <div style={{ color: 'var(--ub-danger, #dc2626)', marginTop: 12, fontSize: 13 }}>{error}</div>}

          <div className="modal-actions">
            <button className="ub-btn ub-btn-ghost" onClick={onClose}>
              Close
            </button>
            {status !== 'Closed' && (
              <button className="ub-btn ub-btn-secondary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save Actuals'}
              </button>
            )}
            {isCommitteeUser && status !== 'Closed' && (
              <button className="ub-btn ub-btn-primary" onClick={() => void handleClose()} disabled={closing || !entity}>
                {closing ? 'Closing…' : 'Close Settlement'}
              </button>
            )}
          </div>
        </>
      )}

      <ContingencyRequestModal
        line={contingencyTarget}
        onClose={() => setContingencyTarget(null)}
        onCreated={async () => {
          toast('Contingency request submitted for President recommendation');
          await Promise.all([reload(), onChanged()]);
        }}
      />
    </Modal>
  );
}
