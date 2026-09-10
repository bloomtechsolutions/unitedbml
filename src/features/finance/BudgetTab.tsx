'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetRow } from '../../types/database';

interface Props {
  budget: BudgetRow | null;
  approvedSpendTotal: number;
  available: number;
  isCommitteeUser: boolean;
  onEditBudget: () => void;
}

export function BudgetTab({ budget, approvedSpendTotal, available, isCommitteeUser, onEditBudget }: Props) {
  const [plannedEvents, setPlannedEvents] = useState(0);

  useEffect(() => {
    supabase
      .from('events')
      .select('planned_budget')
      .eq('archived', false)
      .then(({ data }) => setPlannedEvents((data ?? []).reduce((s, e) => s + (e.planned_budget || 0), 0)));
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Budget Configuration</h3>
        {isCommitteeUser && (
          <button className="btn soft" onClick={onEditBudget}>
            Edit Budget
          </button>
        )}
      </div>
      <div className="attendance-bar">
        <span>Financial Year</span>
        <b>{new Date().getFullYear()}</b>
      </div>
      <div className="attendance-bar">
        <span>Annual Club Budget</span>
        <b>MVR {(budget?.approved_amount ?? 0).toLocaleString()}</b>
      </div>
      <div className="attendance-bar">
        <span>Planned Event Budget</span>
        <b>MVR {plannedEvents.toLocaleString()}</b>
      </div>
      <div className="attendance-bar">
        <span>Approved Expenditure</span>
        <b>MVR {approvedSpendTotal.toLocaleString()}</b>
      </div>
      <div className="attendance-bar">
        <span>Available Balance</span>
        <b>MVR {available.toLocaleString()}</b>
      </div>
    </div>
  );
}
