'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { committeeEffectiveAvailability } from '../committee/availability';
import { FINAL_APPROVER_ROLES } from './types';

interface FinalApproverOption {
  id: string;
  name: string | null;
  role: string;
  email: string | null;
}
import type { DraftLine } from './types';
import { createExpenseRequest } from './useFinance';

const CATEGORY_OPTIONS = ['Event', 'Sports', 'Communication', 'Meeting', 'Travel', 'Other'];

const EMPTY_LINE = (): DraftLine => ({ description: '', quantity: 1, rate: 0, vendor: '', reimbursement_required: false });

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PresidentInfo {
  name: string;
  availability: string;
  leave_from: string | null;
  leave_to: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  defaultEventId?: string;
}

export function RequestFormModal({ open, onClose, onCreated, defaultEventId }: Props) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState<{ id: string; name: string; planned_budget: number }[]>([]);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [purpose, setPurpose] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [finalApproverId, setFinalApproverId] = useState('');
  const [finalApprovers, setFinalApprovers] = useState<FinalApproverOption[]>([]);
  const [president, setPresident] = useState<PresidentInfo | null>(null);
  const [previousApprovedForEvent, setPreviousApprovedForEvent] = useState(0);
  const [clubAvailableBudget, setClubAvailableBudget] = useState(0);
  const [overrunJustification, setOverrunJustification] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setEventId(defaultEventId ?? '');
    setCategory(CATEGORY_OPTIONS[0]);
    setPurpose('');
    setExpenseDate(todayIso());
    setFinalApproverId('');
    setOverrunJustification('');
    setLines([EMPTY_LINE()]);
    setError(null);

    supabase
      .from('events')
      .select('id,name,planned_budget')
      .eq('archived', false)
      .order('name')
      .then(({ data }) => setEvents(data ?? []));
    supabase
      .from('committee_members')
      .select('id,name,role,status,email')
      .eq('status', 'Active')
      .in('role', [...FINAL_APPROVER_ROLES])
      .then(({ data }) => setFinalApprovers((data ?? []).filter((m) => m.name)));
    supabase
      .from('committee_members')
      .select('name,role,availability,leave_from,leave_to')
      .eq('role', 'President')
      .maybeSingle()
      .then(({ data }) => setPresident(data ?? null));

    const year = new Date().getFullYear();
    Promise.all([
      supabase.from('budgets').select('approved_amount').eq('budget_year', year).maybeSingle(),
      supabase.from('expense_requests').select('total_amount').eq('status', 'Approved'),
    ]).then(([budgetRes, requestsRes]) => {
      const annual = budgetRes.data?.approved_amount ?? 0;
      const approved = (requestsRes.data ?? []).reduce((s, r) => s + (r.total_amount || 0), 0);
      setClubAvailableBudget(annual - approved);
    });
  }, [open, defaultEventId]);

  useEffect(() => {
    if (!open || !eventId) {
      setPreviousApprovedForEvent(0);
      return;
    }
    supabase
      .from('expense_requests')
      .select('total_amount')
      .eq('event_id', eventId)
      .eq('status', 'Approved')
      .then(({ data }) => setPreviousApprovedForEvent((data ?? []).reduce((s, r) => s + (r.total_amount || 0), 0)));
  }, [open, eventId]);

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);
  const contingency = Math.round(subtotal * 0.05 * 100) / 100;
  const total = subtotal + contingency;

  const selectedEvent = events.find((e) => e.id === eventId);
  const plannedBudget = selectedEvent?.planned_budget ?? 0;
  const isEventLinked = !!selectedEvent && plannedBudget > 0;
  const projected = previousApprovedForEvent + total;
  const overBudget = isEventLinked && projected > plannedBudget;

  const presidentAvailability = useMemo(() => {
    if (!president) return null;
    return committeeEffectiveAvailability(president, expenseDate);
  }, [president, expenseDate]);
  const presidentOnLeave = presidentAvailability === 'On Leave' || presidentAvailability === 'Leave Scheduled';

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const validLines = lines.filter((l) => l.description.trim());
    if (!validLines.length) {
      setError('At least one line item is required.');
      return;
    }
    const approver = finalApprovers.find((a) => a.id === finalApproverId);
    if (!approver) {
      setError('Select a final approver.');
      return;
    }
    if (overBudget && !overrunJustification.trim()) {
      setError('This request exceeds the event’s planned budget — add a justification for the overrun.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createExpenseRequest(
        {
          title: title.trim(),
          event_id: eventId || null,
          event_name: selectedEvent?.name ?? null,
          category,
          purpose: purpose || null,
          requested_by: profile?.full_name || profile?.email || 'Unknown',
          requester_role: profile?.role || '',
          requested_by_user: profile?.id || '',
          final_approver_name: approver.name ?? '',
          final_approver_role: approver.role,
          final_approver_email: approver.email ?? '',
          president_availability: presidentOnLeave ? 'On Leave' : 'Available',
          request_date: expenseDate,
          planned_event_budget: plannedBudget,
          previous_approved_event_spend: previousApprovedForEvent,
          overrun_justification: overrunJustification || null,
          budget_available_before_approval: clubAvailableBudget,
        },
        validLines
      );
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Expense Request" wide>
      <div className="form-grid">
        <div className="field full">
          <label>Request Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter request title" />
        </div>
        <div className="field">
          <label>Related Event</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">General Club Expense</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Inputter</label>
          <input value={`${profile?.full_name || profile?.email || 'Unknown'} — ${profile?.role || ''}`} readOnly />
        </div>
        <div className="field">
          <label>Final Approver</label>
          <select value={finalApproverId} onChange={(e) => setFinalApproverId(e.target.value)}>
            <option value="">Select available final approver</option>
            {finalApprovers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.role}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Expense Date</label>
          <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </div>

        <div className="field full">
          {!president && (
            <div className="leave-banner">No active President is assigned in Committee Management. Finance cannot determine the recommendation route.</div>
          )}
          {president && presidentOnLeave && (
            <div className="leave-banner">
              <b>{president.name}</b>, President, is marked On Leave. This request will bypass President recommendation and go directly to
              the selected final approver.
            </div>
          )}
          {president && !presidentOnLeave && (
            <div className="leave-banner available">
              <b>{president.name}</b>, President, is available. This request will follow Inputter → President Recommendation → Final
              Approver.
            </div>
          )}
        </div>

        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Purpose / Justification</label>
          <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Why is this expense required?" />
        </div>
      </div>

      {isEventLinked && (
        <div className="overrun-box show">
          <b>{overBudget ? '⚠ Budget Overrun Detected' : 'Event Budget Check'}</b>
          {overBudget && (
            <div>This request would take the event above its original planned budget. The planned budget will remain unchanged.</div>
          )}
          <div className="overrun-grid">
            <div className="mini">
              <small>Planned Budget</small>
              <strong>MVR {plannedBudget.toLocaleString()}</strong>
            </div>
            <div className="mini">
              <small>Previously Approved</small>
              <strong>MVR {previousApprovedForEvent.toLocaleString()}</strong>
            </div>
            <div className="mini">
              <small>Current Request</small>
              <strong>MVR {total.toLocaleString()}</strong>
            </div>
            <div className="mini">
              <small>{overBudget ? 'Overrun' : 'Remaining After Request'}</small>
              <strong>MVR {Math.abs(plannedBudget - projected).toLocaleString()}</strong>
            </div>
          </div>
          {overBudget && (
            <div className="field full" style={{ marginTop: 12 }}>
              <label>Budget Overrun Justification</label>
              <textarea
                value={overrunJustification}
                onChange={(e) => setOverrunJustification(e.target.value)}
                placeholder="Explain why this request exceeds the event's planned budget..."
              />
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
        <div>
          <h4 style={{ margin: 0 }}>Expense Items</h4>
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
            Add one or more expense lines.
          </div>
        </div>
        <button className="btn soft" type="button" onClick={() => setLines((prev) => [...prev, EMPTY_LINE()])}>
          + Add Item
        </button>
      </div>
      {lines.map((line, i) => (
        <div key={i} className="ap-bill-row" style={{ gridTemplateColumns: '2fr 130px 90px 110px 1fr auto' }}>
          <div className="field">
            <label>Description</label>
            <input value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="Expense description" />
          </div>
          <div className="field">
            <label>Reimbursement</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <input
                type="checkbox"
                checked={line.reimbursement_required}
                onChange={(e) => updateLine(i, { reimbursement_required: e.target.checked })}
              />
              Requires reimbursement pre-approval
            </label>
          </div>
          <div className="field">
            <label>Qty</label>
            <input type="number" min={0} value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Rate</label>
            <input type="number" min={0} value={line.rate} onChange={(e) => updateLine(i, { rate: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Vendor</label>
            <input value={line.vendor} onChange={(e) => updateLine(i, { vendor: e.target.value })} />
          </div>
          <button className="btn danger" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
            ✕
          </button>
        </div>
      ))}

      <div className="mini-stat" style={{ marginTop: 16 }}>
        <div className="mini">
          <small>Subtotal</small>
          <strong>MVR {subtotal.toLocaleString()}</strong>
        </div>
        <div className="mini">
          <small>Contingency (5%)</small>
          <strong>MVR {contingency.toLocaleString()}</strong>
        </div>
        <div className="mini">
          <small>Request Total</small>
          <strong>MVR {total.toLocaleString()}</strong>
        </div>
      </div>

      <div className="finance-note" style={{ marginTop: 14 }}>
        Available budget before this request: <b>MVR {clubAvailableBudget.toLocaleString()}</b>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </div>
    </Modal>
  );
}
