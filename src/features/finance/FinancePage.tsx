'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { ContingencyPanel } from '../settlements/ContingencyPanel';
import { SettlementModal } from '../settlements/SettlementModal';
import { useSettlementRegister } from '../settlements/useSettlements';
import { RequestDetailModal } from './RequestDetailModal';
import { RequestFormModal } from './RequestFormModal';
import type { ExpenseRequestWithLines } from './types';
import { EXPENSE_STATUSES } from './types';
import {
  approvedSpend,
  availableBudget,
  decideReversal,
  useBudget,
  useCurrentActor,
  useExpenseRequests,
  useReversals,
} from './useFinance';

type SubTab = 'requests' | 'approvals' | 'reversals' | 'settlements' | 'contingency';

export function FinancePage() {
  const { budget, loading: budgetLoading, reload: reloadBudget } = useBudget();
  const { requests, loading, error, reload } = useExpenseRequests();
  const { reversals, loading: reversalsLoading, reload: reloadReversals } = useReversals();
  const actor = useCurrentActor();
  const { profile } = useAuth();
  const toast = useToast();

  const [subTab, setSubTab] = useState<SubTab>('requests');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busyReversalId, setBusyReversalId] = useState<string | null>(null);
  const [settlementKey, setSettlementKey] = useState<string | null>(null);
  const [settlementStatusFilter, setSettlementStatusFilter] = useState('');
  const searchParams = useSearchParams();
  const { rows: settlementRows, loading: settlementsLoading, reload: reloadSettlements } = useSettlementRegister();

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spend = approvedSpend(requests);
  const available = availableBudget(budget, requests);
  const pending = requests.filter(
    (r) => r.status === 'Pending President Recommendation' || r.status === 'Pending Final Approval'
  );

  const filtered = requests.filter((r) => {
    const matchesSearch = !search || (r.title || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const detail = detailId ? requests.find((r) => r.id === detailId) ?? null : null;

  const refreshAll = async () => {
    await Promise.all([reload(), reloadBudget(), reloadReversals()]);
  };

  const handleDecideReversal = async (reversal: (typeof reversals)[number], decision: 'approve' | 'reject') => {
    setBusyReversalId(reversal.id);
    try {
      const comment = prompt(`Comment for ${decision === 'approve' ? 'approving' : 'rejecting'} this reversal (optional):`) ?? '';
      await decideReversal(reversal, decision, comment, actor.name, actor.id);
      await refreshAll();
      toast(decision === 'approve' ? 'Reversal approved — amount released to budget' : 'Reversal rejected');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to decide reversal.');
    } finally {
      setBusyReversalId(null);
    }
  };

  if (loading || budgetLoading) return <div>Loading finance…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load finance: {error}</div>;

  const utilizationPct = budget?.approved_amount ? Math.min(100, Math.round((spend / budget.approved_amount) * 100)) : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Finance</h2>
          <p>Submit expense requests, track approvals, and monitor budget utilization.</p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setFormOpen(true)}>
            + New Request
          </button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="lbl">Annual Budget</div>
          <strong>{(budget?.approved_amount ?? 0).toLocaleString()}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Approved Spend</div>
          <strong>{spend.toLocaleString()}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Available Budget</div>
          <strong>{available.toLocaleString()}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Pending Approvals</div>
          <strong>{pending.length}</strong>
        </div>
      </div>

      <div className="committee-term-overview">
        <div className="committee-overline">Budget Utilization</div>
        <div className="committee-term-overview-progress">
          <div className="committee-term-overview-track">
            <span style={{ width: `${utilizationPct}%` }} />
          </div>
          <div className="committee-term-overview-foot">
            <strong>{utilizationPct}% utilized</strong>
            <span>
              {spend.toLocaleString()} of {(budget?.approved_amount ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${subTab === 'requests' ? 'active' : ''}`} onClick={() => setSubTab('requests')}>
          Requests
        </button>
        <button className={`tab ${subTab === 'approvals' ? 'active' : ''}`} onClick={() => setSubTab('approvals')}>
          Approvals ({pending.length})
        </button>
        <button className={`tab ${subTab === 'reversals' ? 'active' : ''}`} onClick={() => setSubTab('reversals')}>
          Reversals ({reversals.length})
        </button>
        <button className={`tab ${subTab === 'settlements' ? 'active' : ''}`} onClick={() => setSubTab('settlements')}>
          Settlements
        </button>
        <button className={`tab ${subTab === 'contingency' ? 'active' : ''}`} onClick={() => setSubTab('contingency')}>
          Contingency
        </button>
      </div>

      {subTab === 'requests' && (
        <>
          <div className="toolbar">
            <div className="filters">
              <input placeholder="Search requests…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {EXPENSE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Event</th>
                <th>Requested By</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(r.id)}>
                  <td>{r.title || r.request_number}</td>
                  <td>{r.event_name || '—'}</td>
                  <td>{r.requested_by}</td>
                  <td>{r.total_amount.toLocaleString()}</td>
                  <td>
                    <span className="pill plan">{r.status}</span>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No requests match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {subTab === 'approvals' && (
        <table className="table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Stage</th>
              <th>Total</th>
              <th>Waiting On</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pending.map((r) => (
              <tr key={r.id}>
                <td>{r.title || r.request_number}</td>
                <td>{r.status === 'Pending President Recommendation' ? 'President' : 'Final Approval'}</td>
                <td>{r.total_amount.toLocaleString()}</td>
                <td>{r.status === 'Pending President Recommendation' ? 'President' : r.final_approver_name}</td>
                <td>
                  <button className="btn ghost" onClick={() => setDetailId(r.id)}>
                    Review
                  </button>
                </td>
              </tr>
            ))}
            {!pending.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  Nothing pending approval.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {subTab === 'reversals' && (
        <table className="table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Reason</th>
              <th>Requested By</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reversalsLoading && (
              <tr>
                <td colSpan={4}>Loading…</td>
              </tr>
            )}
            {reversals.map((rev) => (
              <tr key={rev.id}>
                <td>{requests.find((r) => r.id === rev.expense_request_id)?.title || rev.expense_request_id}</td>
                <td>{rev.reason}</td>
                <td>{rev.requested_by_name}</td>
                <td>
                  {profile?.role === 'President' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn danger"
                        disabled={busyReversalId === rev.id}
                        onClick={() => void handleDecideReversal(rev, 'reject')}
                      >
                        Reject
                      </button>
                      <button
                        className="btn primary"
                        disabled={busyReversalId === rev.id}
                        onClick={() => void handleDecideReversal(rev, 'approve')}
                      >
                        Approve
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>President decision required</span>
                  )}
                </td>
              </tr>
            ))}
            {!reversalsLoading && !reversals.length && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No pending reversal requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {subTab === 'settlements' && (
        <>
          <div className="toolbar">
            <div className="filters">
              <select value={settlementStatusFilter} onChange={(e) => setSettlementStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Pending Actuals">Pending Actuals</option>
                <option value="Actuals Entered">Actuals Entered</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>
          {settlementsLoading && <div>Loading settlements…</div>}
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Scope</th>
                <th>Approved</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>Contingency Released</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {settlementRows
                .filter((r) => !settlementStatusFilter || r.status === settlementStatusFilter)
                .map((r) => (
                  <tr key={r.key}>
                    <td>
                      {r.reference}
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.title}</div>
                    </td>
                    <td>
                      <span className="pill plan">{r.isGeneral ? 'General Expense' : 'Event-linked'}</span>
                      {r.pendingContingency > 0 && (
                        <div style={{ fontSize: 10.5, color: 'var(--danger)' }}>{r.pendingContingency} contingency pending</div>
                      )}
                    </td>
                    <td>{r.approved.toLocaleString()}</td>
                    <td>{r.actual.toLocaleString()}</td>
                    <td style={{ color: r.actual > r.approved ? 'var(--danger)' : undefined }}>{(r.approved - r.actual).toLocaleString()}</td>
                    <td>{r.contingencyReleased ? r.contingencyReleased.toLocaleString() : '—'}</td>
                    <td>
                      <span className="pill plan">{r.status}</span>
                    </td>
                    <td>
                      <button className="btn ghost" onClick={() => setSettlementKey(r.key)}>
                        Open Settlement
                      </button>
                    </td>
                  </tr>
                ))}
              {!settlementsLoading && !settlementRows.length && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No approved expenses awaiting settlement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {subTab === 'contingency' && <ContingencyPanel />}

      <RequestFormModal open={formOpen} onClose={() => setFormOpen(false)} onCreated={refreshAll} />
      <RequestDetailModal
        request={detail as ExpenseRequestWithLines | null}
        onClose={() => setDetailId(null)}
        onRefresh={refreshAll}
      />
      <SettlementModal settlementKey={settlementKey} onClose={() => setSettlementKey(null)} onChanged={reloadSettlements} />
    </div>
  );
}
