'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RequestCard } from './RequestCard';
import type { ExpenseRequestWithLines } from './types';
import { EXPENSE_STATUSES } from './types';

type BudgetMode = 'approved' | 'actual' | 'planned';

interface Props {
  annualBudget: number;
  approvedSpendTotal: number;
  available: number;
  requests: ExpenseRequestWithLines[];
  pendingCount: number;
  pendingSettlementCount: number;
  onOpenRequest: (id: string) => void;
  onRequestReversal: (request: ExpenseRequestWithLines) => void;
  onNewRequest: () => void;
}

export function FinanceDashboardTab({
  annualBudget,
  approvedSpendTotal,
  available,
  requests,
  pendingCount,
  pendingSettlementCount,
  onOpenRequest,
  onRequestReversal,
  onNewRequest,
}: Props) {
  const [mode, setMode] = useState<BudgetMode>('approved');
  const [eventTotals, setEventTotals] = useState({ planned: 0, actual: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

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
    return requests
      .filter((r) => r.status === 'Approved' && (r.request_date || '').startsWith(month))
      .reduce((s, r) => s + (r.total_amount || 0), 0);
  }, [requests]);

  const primaryValue = mode === 'approved' ? approvedSpendTotal : mode === 'actual' ? eventTotals.actual : eventTotals.planned;
  const primaryLabel = mode === 'approved' ? 'Approved Spend' : mode === 'actual' ? 'Actual Expense' : 'Planned Budget';
  const pct = annualBudget ? Math.min(100, Math.round((primaryValue / annualBudget) * 100)) : 0;
  const ringDeg = (pct / 100) * 360;

  const filteredRequests = useMemo(() => {
    const today = new Date();
    return requests.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.event_name || '').toLowerCase().includes(q) ||
        (r.requested_by || '').toLowerCase().includes(q);
      const matchesStatus = !statusFilter || r.status === statusFilter;
      let matchesDate = true;
      if (r.request_date && dateFilter !== 'all') {
        const d = new Date(r.request_date);
        if (dateFilter === '7') matchesDate = today.getTime() - d.getTime() <= 7 * 86400000;
        else if (dateFilter === '30') matchesDate = today.getTime() - d.getTime() <= 30 * 86400000;
        else if (dateFilter === 'month') matchesDate = r.request_date.slice(0, 7) === today.toISOString().slice(0, 7);
        else if (dateFilter === 'year') matchesDate = r.request_date.slice(0, 4) === String(today.getFullYear());
      }
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [requests, search, statusFilter, dateFilter]);

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
              Approved
            </button>
            <button className={mode === 'actual' ? 'active' : ''} onClick={() => setMode('actual')}>
              Actual
            </button>
            <button className={mode === 'planned' ? 'active' : ''} onClick={() => setMode('planned')}>
              Planned
            </button>
          </div>
        </div>
        <div className="budget-widget">
          <div>
            <div
              className="budget-ring"
              style={{ background: `conic-gradient(var(--primary) 0deg, var(--primary2) ${ringDeg}deg, #e9edf5 ${ringDeg}deg)` }}
            >
              <div className="budget-ring-center">
                <b>{pct}%</b>
                <small>{primaryLabel} vs annual budget</small>
              </div>
            </div>
            <div className="budget-ring-caption">Interactive budget view</div>
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
        </div>
      </div>

      <div className="card finance-requests-card">
        <div className="card-header">
          <h3>Recent Expense Requests</h3>
          <button className="btn soft" onClick={onNewRequest}>
            + New Request
          </button>
        </div>
        <div className="finance-dashboard-filters">
          <input
            placeholder="Search request, event or requester..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {EXPENSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="all">All Dates</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <div className="summary">{filteredRequests.length} requests</div>
        </div>
        {filteredRequests.slice(0, 8).map((r) => (
          <RequestCard key={r.id} request={r} onOpen={() => onOpenRequest(r.id)} onRequestReversal={() => onRequestReversal(r)} />
        ))}
        {!filteredRequests.length && <p style={{ color: 'var(--muted)', fontSize: 12 }}>No requests match your filters.</p>}
      </div>
    </div>
  );
}
