'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageInfoPanel } from '../../components/PageInfoPanel';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { useStandingAllocationsActual } from '../allocations/useAllocations';
import { ContingencyPanel } from '../settlements/ContingencyPanel';
import { SettlementModal } from '../settlements/SettlementModal';
import { settlementKeyForRequest, useSettlementRegister } from '../settlements/useSettlements';
import { BudgetModal } from './BudgetModal';
import { BudgetTab } from './BudgetTab';
import { ExcoReportTab } from './ExcoReportTab';
import { FinanceDashboardTab } from './FinanceDashboardTab';
import { RequestCard } from './RequestCard';
import { RequestDetailModal } from './RequestDetailModal';
import { RequestFormModal } from './RequestFormModal';
import type { ExpenseRequestWithLines } from './types';
import { EXPENSE_STATUSES } from './types';
import {
  approvedSpend,
  availableBudget,
  decideReversal,
  requestReversal,
  useBudget,
  useCurrentActor,
  useExpenseRequests,
  useReversals,
} from './useFinance';

type SubTab = 'dashboard' | 'requests' | 'approvals' | 'reversals' | 'settlements' | 'contingency' | 'budget' | 'exco' | 'info';

const FINANCE_INFO = [
  {
    q: 'How does an expense request get approved?',
    a: 'An Inputter raises the request against an event or line item. It then needs President Recommendation (a committee sign-off), then Email Final Approval — sent out for the final decision-maker\'s approval by email. Once Approved, the amount counts against the annual budget immediately, before any money has actually moved.',
  },
  {
    q: 'What is a Settlement?',
    a: "After the activity happens, someone enters the actual amount spent to close out the request. It's capped so it can never exceed the approved amount — both in the form and again on the server — so an over-run always has to go through Contingency or a fresh request instead of slipping through at close-out.",
  },
  {
    q: 'What is Contingency for?',
    a: 'A controlled top-up when a line item runs short of its approved amount. It routes: requested → President recommendation → sent to Procurement by email → their decision recorded, with the released amount tracked separately from the original approval.',
  },
  {
    q: 'What can I do in Reversals?',
    a: 'Request that an approved amount be released back to the budget — useful if a request is cancelled or reduced after approval. A committee member approves or rejects the reversal; approving it frees the amount back into Available Balance.',
  },
  {
    q: 'What sets the Available Balance figure?',
    a: 'Annual Budget minus everything currently committed against it: approved expense requests, plus this year\'s Standing Allocations actuals (Fun with Team, UBML Allowance, Women\'s/Men\'s Day, Year End Activities) reported monthly by Finance.',
  },
  {
    q: 'What is the Exco Report?',
    a: 'A ready-made export of the current budget position for the executive committee — the same figures shown on the Dashboard tab, formatted for sharing.',
  },
];

export function FinancePage() {
  const { budget, loading: budgetLoading, reload: reloadBudget } = useBudget();
  const { requests, loading, error, reload } = useExpenseRequests();
  const { reversals, loading: reversalsLoading, reload: reloadReversals } = useReversals();
  const actor = useCurrentActor();
  const { profile, isCommitteeUser } = useAuth();
  const toast = useToast();

  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busyReversalId, setBusyReversalId] = useState<string | null>(null);
  const [settlementKey, setSettlementKey] = useState<string | null>(null);
  const [settlementStatusFilter, setSettlementStatusFilter] = useState('');
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const { rows: settlementRows, loading: settlementsLoading, reload: reloadSettlements } = useSettlementRegister();
  const { total: standingAllocationsActual, thisMonthTotal: standingAllocationsThisMonth } =
    useStandingAllocationsActual(new Date().getFullYear());

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
    const openId = searchParams.get('open');
    if (openId) setDetailId(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spend = approvedSpend(requests);
  const available = availableBudget(budget, requests, standingAllocationsActual);
  const pending = requests.filter(
    (r) => r.status === 'Pending President Recommendation' || r.status === 'Pending Final Approval'
  );
  const pendingSettlementCount = settlementRows.filter((r) => r.status !== 'Closed').length;
  const settlementStatusByKey = new Map(settlementRows.map((s) => [s.key, s.status] as const));
  const settlementKeyForExpenseRequest = (r: ExpenseRequestWithLines) => (r.event_id ? r.event_id : settlementKeyForRequest(r.id));

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

  const handleRequestReversal = async (request: ExpenseRequestWithLines) => {
    const reason = prompt('Reason for reversal:');
    if (!reason) return;
    try {
      await requestReversal(request.id, reason, profile?.full_name || '', profile?.id || '');
      await refreshAll();
      toast('Reversal requested');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to request reversal.');
    }
  };

  if (loading || budgetLoading) return <div>Loading finance…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load finance: {error}</div>;

  const utilizationPct = budget?.approved_amount ? Math.min(100, Math.round((spend / budget.approved_amount) * 100)) : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Finance Management</h2>
        </div>
        <div className="actions" style={{ display: 'flex', gap: 8 }}>
          {profile?.role === 'Treasurer' && (
            <button className="btn ghost" onClick={() => setBudgetModalOpen(true)}>
              Edit Annual Budget
            </button>
          )}
          <button className="btn primary" onClick={() => setFormOpen(true)}>
            + New Expense Request
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${subTab === 'dashboard' ? 'active' : ''}`} onClick={() => setSubTab('dashboard')}>
          Dashboard
        </button>
        <button className={`tab ${subTab === 'requests' ? 'active' : ''}`} onClick={() => setSubTab('requests')}>
          Expense Requests
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
        <button className={`tab ${subTab === 'budget' ? 'active' : ''}`} onClick={() => setSubTab('budget')}>
          Budget
        </button>
        <button className={`tab ${subTab === 'exco' ? 'active' : ''}`} onClick={() => setSubTab('exco')}>
          Exco Report
        </button>
        <button className={`tab ${subTab === 'info' ? 'active' : ''}`} onClick={() => setSubTab('info')}>
          Info
        </button>
      </div>

      {subTab === 'info' && <PageInfoPanel sections={FINANCE_INFO} />}

      {subTab === 'dashboard' && (
        <FinanceDashboardTab
          annualBudget={budget?.approved_amount ?? 0}
          approvedSpendTotal={spend}
          available={available}
          standingAllocationsActual={standingAllocationsActual}
          standingAllocationsThisMonth={standingAllocationsThisMonth}
          requests={requests}
          pendingCount={pending.length}
          pendingSettlementCount={pendingSettlementCount}
          onOpenRequest={setDetailId}
          onRequestReversal={handleRequestReversal}
          onNewRequest={() => setFormOpen(true)}
          settlementStatusByKey={settlementStatusByKey}
          settlementKeyForRequest={settlementKeyForExpenseRequest}
          onEnterActual={setSettlementKey}
          onViewAll={() => setSubTab('requests')}
        />
      )}

      {subTab === 'requests' && (
        <>
          <div className="committee-term-overview" style={{ marginBottom: 18 }}>
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
          <div className="toolbar">
            <div className="filters">
              <input placeholder="Search request or event..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {EXPENSE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filtered.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              onOpen={() => setDetailId(r.id)}
              onRequestReversal={() => void handleRequestReversal(r)}
              settlementStatus={settlementStatusByKey.get(settlementKeyForExpenseRequest(r))}
              onEnterActual={() => setSettlementKey(settlementKeyForExpenseRequest(r))}
            />
          ))}
          {!filtered.length && <p style={{ textAlign: 'center', color: 'var(--muted)' }}>No requests match your filters.</p>}
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
          <div className="finance-settlement-head">
            <div>
              <h3>Actual Expense Settlement</h3>
              <p>Finance master workspace for Event-linked and General Expense approved-vs-actual reconciliation, reimbursement/AP settlement and contingency utilization.</p>
            </div>
            <button className="btn ghost" onClick={() => void reloadSettlements()}>
              ↻ Refresh
            </button>
          </div>
          <div className="finance-settlement-summary">
            <div>
              <small>Pending Actuals</small>
              <b>{settlementRows.filter((r) => r.status === 'Pending Actuals').length}</b>
              <span>require action</span>
            </div>
            <div>
              <small>Actuals Entered</small>
              <b>{settlementRows.filter((r) => r.status === 'Actuals Entered').length}</b>
              <span>ready for review</span>
            </div>
            <div>
              <small>Closed</small>
              <b>{settlementRows.filter((r) => r.status === 'Closed').length}</b>
              <span>financially settled</span>
            </div>
            <div>
              <small>Total Actual</small>
              <b>MVR {settlementRows.reduce((s, r) => s + r.actual, 0).toLocaleString()}</b>
              <span>event + general actuals</span>
            </div>
          </div>
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
                        {r.status === 'Closed' ? 'View Settlement' : 'Open Settlement'}
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

      {subTab === 'budget' && (
        <BudgetTab
          budget={budget}
          approvedSpendTotal={spend}
          available={available}
          isCommitteeUser={isCommitteeUser}
          onEditBudget={() => setBudgetModalOpen(true)}
        />
      )}

      {subTab === 'exco' && <ExcoReportTab annualBudget={budget?.approved_amount ?? 0} />}

      <RequestFormModal open={formOpen} onClose={() => setFormOpen(false)} onCreated={refreshAll} />
      <RequestDetailModal
        request={detail as ExpenseRequestWithLines | null}
        onClose={() => setDetailId(null)}
        onRefresh={refreshAll}
      />
      <SettlementModal settlementKey={settlementKey} onClose={() => setSettlementKey(null)} onChanged={reloadSettlements} />
      <BudgetModal
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        budget={budget}
        onSaved={async () => {
          await reloadBudget();
          toast('Annual budget updated');
        }}
      />
    </div>
  );
}
