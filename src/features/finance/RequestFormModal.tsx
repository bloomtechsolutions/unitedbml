'use client';

import { useEffect, useState } from 'react';
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

const EMPTY_LINE = (): DraftLine => ({ description: '', quantity: 1, rate: 0, vendor: '', reimbursement_required: false });

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
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [category, setCategory] = useState('');
  const [purpose, setPurpose] = useState('');
  const [finalApproverId, setFinalApproverId] = useState('');
  const [finalApprovers, setFinalApprovers] = useState<FinalApproverOption[]>([]);
  const [presidentAvailability, setPresidentAvailability] = useState<'Available' | 'On Leave'>('Available');
  const [lines, setLines] = useState<DraftLine[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setEventId(defaultEventId ?? '');
    setCategory('');
    setPurpose('');
    setFinalApproverId('');
    setLines([EMPTY_LINE()]);
    setError(null);

    supabase.from('events').select('id,name').eq('archived', false).order('name').then(({ data }) => setEvents(data ?? []));
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
      .then(({ data }) => {
        if (!data) return;
        setPresidentAvailability(committeeEffectiveAvailability(data) === 'On Leave' ? 'On Leave' : 'Available');
      });
  }, [open, defaultEventId]);

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);
  const contingency = Math.round(subtotal * 0.05 * 100) / 100;

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
    setSaving(true);
    setError(null);
    try {
      await createExpenseRequest(
        {
          title: title.trim(),
          event_id: eventId || null,
          event_name: events.find((e) => e.id === eventId)?.name ?? null,
          category: category || null,
          purpose: purpose || null,
          requested_by: profile?.full_name || profile?.email || 'Unknown',
          requester_role: profile?.role || '',
          requested_by_user: profile?.id || '',
          final_approver_name: approver.name ?? '',
          final_approver_role: approver.role,
          final_approver_email: approver.email ?? '',
          president_availability: presidentAvailability,
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
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Related Event (optional)</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">None</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="field full">
          <label>Purpose</label>
          <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>
        <div className="field">
          <label>Final Approver</label>
          <select value={finalApproverId} onChange={(e) => setFinalApproverId(e.target.value)}>
            <option value="">Select approver</option>
            {finalApprovers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>President Availability</label>
          <select
            value={presidentAvailability}
            onChange={(e) => setPresidentAvailability(e.target.value as 'Available' | 'On Leave')}
          >
            <option value="Available">Available</option>
            <option value="On Leave">On Leave (skip to Final Approval)</option>
          </select>
        </div>
      </div>

      <h4 style={{ marginTop: 18, marginBottom: 8 }}>Line Items</h4>
      {lines.map((line, i) => (
        <div key={i} className="ap-bill-row" style={{ gridTemplateColumns: '2fr 90px 110px 1fr 90px auto' }}>
          <div className="field">
            <label>Description</label>
            <input value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
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
          <div className="field">
            <label>Reimb.</label>
            <input
              type="checkbox"
              checked={line.reimbursement_required}
              onChange={(e) => updateLine(i, { reimbursement_required: e.target.checked })}
            />
          </div>
          <button className="btn danger" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
            Remove
          </button>
        </div>
      ))}
      <button className="btn ghost" onClick={() => setLines((prev) => [...prev, EMPTY_LINE()])}>
        + Add Line
      </button>

      <div className="mini-stat" style={{ marginTop: 16 }}>
        <div className="mini">
          <small>Subtotal</small>
          <strong>{subtotal.toLocaleString()}</strong>
        </div>
        <div className="mini">
          <small>Contingency (5%)</small>
          <strong>{contingency.toLocaleString()}</strong>
        </div>
        <div className="mini">
          <small>Total</small>
          <strong>{(subtotal + contingency).toLocaleString()}</strong>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    </Modal>
  );
}
