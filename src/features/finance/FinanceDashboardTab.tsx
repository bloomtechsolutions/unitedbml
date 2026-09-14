'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RequestCard } from './RequestCard';
import type { ExpenseRequestWithLines } from './types';

type BudgetMode = 'approved' | 'actual' | 'planned';

const MODE_COLOR: Record<BudgetMode, string> = { approved: '#4d57d9', actual: '#00a98e', planned: '#00b5e4' };

function ringColor(pct: number): string {
  if (pct >= 90) return '#e01b22';
  if (pct >= 70) return '#e08a1b';
  return '#00a98e';
}

interface Props {
  annualBudget: number;
  approvedSpendTotal: number;
  available: number;
  standingAllocationsActual: number;
  standingAllocationsThisMonth: number;
  requests: ExpenseRequestWithLines[];
  pendingCount: number;
  pendingSettlementCount: number;
  onOpenRequest: (id: string) => void;
  onRequestReversal: (request: ExpenseRequestWithLines) => void;
  onNewRequest: () => void;
  settlementStatusByKey: Map<string, string>;
  settlementKeyForRequest: (request: ExpenseRequestWithLines) => string;
  onEnterActual: (settlementKey: string) => void;
  onViewAll: () => void;
}

export function FinanceDashboardTab({
  annualBudget,
  approvedSpendTotal,
  available,
  standingAllocationsActual,
  standingAllocationsThisMonth,
  requests,
  pendingCount,
  pendingSettlementCount,
  onOpenRequest,
  onRequestReversal,
  onNewRequest,
  settlementStatusByKey,
  settlementKeyForRequest,
  onEnterActual,
  onViewAll,
}: Props) {
  const [mode, setMode] = useState<BudgetMode>('approved');
  const [eventTotals, setEventTotals] = useState({ planned: 0, actual: 0 });

  useEffect(() => {
    supabase
      .from('events')
      .select('planned_budget,actual_expense_total')
      .eq('archived', false)
      .then(({ data }) => {
        const rows = data ?? [];
        setEventTotals({
          planned: rows.reduce((s, e) => s + (e.planned_budget || 0), 0),
          actual: rows.reduce((s, e) => s + (e.actual_expense_total || 0), 0),
        });
      });
  }, []);

  const thisMonthTotal = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const requestsThisMonth = requests
      .filter((r) => r.status === 'Approved' && (r.request_date || '').startsWith(month))
      .reduce((s, r) => s + (r.total_amount || 0), 0);
    return requestsThisMonth + standingAllocationsThisMonth;
  }, [requests, standingAllocationsThisMonth]);

  const byMode: Record<BudgetMode, { label: string; value: number }> = {
    approved: { label: 'Approved Spend', value: approvedSpendTotal },
    actual: { label: 'Actual Expense', value: eventTotals.actual + standingAllocationsActual },
    planned: { label: 'Planned Budget', value: eventTotals.planned },
  };
  const primaryValue = byMode[mode].value;
  const primaryLabel = byMode[mode].label;
  const pct = annualBudget ? Math.min(100, Math.round((primaryValue / annualBudget) * 100)) : 0;
  const ringDeg = (pct / 100) * 360;
  const ringHue = ringColor(pct);

  const recentRequests = useMemo(() => requests.slice(0, 5), [requests]);

  return (
    <div className="finance-dashboard-stack">
      <div className="card dashboard-budget-card finance-dashboard-top">
        <div className="card-header">
          <div>
            <h3 style={{ margin: 0 }}>Budget Utilization</h3>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              {primaryLabel} currently uses {pct}% of the annual budget.
            </div>
          </div>
          <div className="budget-mode-tabs">
            <button className={mode === 'approved' ? 'active' : ''} onClick={() => setMode('approved')}>
              <span className="budget-mode-dot" style={{ background: MODE_COLOR.approved }} />
              Approved
            </button>
            <button className={mode === 'actual' ? 'active' : ''} onClick={() => setMode('actual')}>
              <span className="budget-mode-dot" style={{ background: MODE_COLOR.actual }} />
              Actual
            </button>
            <button className={mode === 'planned' ? 'active' : ''} onClick={() => setMode('planned')}>
              <span className="budget-mode-dot" style={{ background: MODE_COLOR.planned }} />
              Planned
            </button>
          </div>
        </div>
        <div className="budget-widget">
          <div>
            <div
              className="budget-ring"
              style={{ background: `conic-gradient(${ringHue} 0deg, ${ringHue} ${ringDeg}deg, #e9edf5 ${ringDeg}deg)`, transition: 'background 0.5s ease' }}
            >
              <div className="budget-ring-center">
                <b style={{ color: ringHue }}>{pct}%</b>
                <small>{primaryLabel} vs annual budget</small>
              </div>
            </div>
            <div className="budget-ring-caption">
              MVR {primaryValue.toLocaleString()} of MVR {annualBudget.toLocaleString()}
            </div>
          </div>
          <div className="budget-breakdown">
            <div className="budget-headline">
              <div className="budget-stat">
                <small>Annual Budget</small>
                <strong>MVR {annualBudget.toLocaleString()}</strong>
              </div>
              <div className="budget-stat">
                <small>{primaryLabel}</small>
                <strong>MVR {primaryValue.toLocaleString()}</strong>
              </div>
              <div className="budget-stat">
                <small>Available Balance</small>
                <strong>MVR {available.toLocaleString()}</strong>
              </div>
              <div className="budget-stat">
                <small>This Month</small>
                <strong>MVR {thisMonthTotal.toLocaleString()}</strong>
              </div>
            </div>
            <div className="budget-compare">
              {(['approved', 'actual', 'planned'] as BudgetMode[]).map((m) => {
                const barPct = annualBudget ? Math.min(100, Math.round((byMode[m].value / annualBudget) * 100)) : 0;
                return (
                  <button key={m} className={`budget-compare-row ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
                    <span className="budget-compare-label">{byMode[m].label}</span>
                    <span className="budget-compare-track">
                      <span className="budget-compare-fill" style={{ width: `${barPct}%`, background: MODE_COLOR[m] }} />
                    </span>
                    <span className="budget-compare-value">MVR {byMode[m].value.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mini-stat" style={{ marginTop: 16 }}>
          <div className="mini">
            <small>Unutilized Approved</small>
            <strong>MVR {Math.max(0, annualBudget - approvedSpendTotal).toLocaleString()}</strong>
          </div>
          <div className="mini">
            <small>Pending Requests</small>
            <strong>{pendingCount}</strong>
          </div>
          <div className="mini">
            <small>Pending Settlements</small>
            <strong>{pendingSettlementCount}</strong>
          </div>
          <div className="mini">
            <small>Standing Allocations (YTD)</small>
            <strong>MVR {standingAllocationsActual.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <div className="card finance-requests-card">
        <div className="card-header">
          <div>
            <h3>Recent Expense Requests</h3>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Last {recentRequests.length} submitted, most recent first.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onViewAll}>
              View All
            </button>
            <button className="btn soft" onClick={onNewRequest}>
              + New Request
            </button>
          </div>
        </div>
        {recentRequests.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            onOpen={() => onOpenRequest(r.id)}
            onRequestReversal={() => onRequestReversal(r)}
            settlementStatus={settlementStatusByKey.get(settlementKeyForRequest(r))}
            onEnterActual={() => onEnterActual(settlementKeyForRequest(r))}
          />
        ))}
        {!recentRequests.length && <p style={{ color: 'var(--muted)', fontSize: 12 }}>No expense requests yet.</p>}
      </div>
    </div>
  );
}
