'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { StandingAllocationEntryRow, StandingAllocationRow } from '../../types/database';
import { addAllocationEntry, deleteAllocationEntry } from './useAllocations';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  open: boolean;
  onClose: () => void;
  allocation: StandingAllocationRow | null;
  entries: StandingAllocationEntryRow[];
  onSaved: () => Promise<void>;
}

export function AllocationEntriesModal({ open, onClose, allocation, entries, onSaved }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const now = new Date();
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!allocation) return null;

  const rows = entries
    .filter((e) => e.allocation_id === allocation.id)
    .sort((a, b) => b.period_year - a.period_year || b.period_month - a.period_month);
  const yearTotal = rows.filter((e) => e.period_year === periodYear).reduce((s, e) => s + (e.actual_amount || 0), 0);

  const resetForm = () => {
    setAmount(0);
    setDescription('');
    setSourceRef('');
    setError(null);
  };

  const handleAdd = async () => {
    if (amount <= 0) {
      setError('Enter the actual amount reported by Finance.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addAllocationEntry({
        allocation_id: allocation.id,
        period_year: periodYear,
        period_month: periodMonth,
        actual_amount: amount,
        description: description || null,
        source_reference: sourceRef || null,
        recorded_by: profile?.id,
        recorded_by_name: profile?.full_name,
      });
      await onSaved();
      resetForm();
      toast('Actual spend recorded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record this entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this entry?')) return;
    try {
      await deleteAllocationEntry(id);
      await onSaved();
      toast('Entry removed.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove entry.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${allocation.name} — Monthly Actuals`} wide>
      <div className="ub-kpi-strip" style={{ marginBottom: 14 }}>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">
            {yearTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="ub-kpi-strip-label">Actual — {periodYear}</span>
        </div>
        {allocation.cadence === 'Annual' && (
          <div className="ub-kpi-strip-item">
            <span className="ub-kpi-strip-value">
              {Math.max(0, allocation.allocated_amount - yearTotal).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="ub-kpi-strip-label">Remaining of Pool</span>
          </div>
        )}
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{rows.length}</span>
          <span className="ub-kpi-strip-label">Entries Logged</span>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Log Finance's monthly actual</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div className="field">
            <label>Month</label>
            <select value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Year</label>
            <input type="number" value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Actual Amount (MVR)</label>
            <input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Source Ref (Finance sheet)</label>
            <input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </div>
        {error && <div style={{ color: 'var(--danger)', marginTop: 8, fontSize: 13 }}>{error}</div>}
        <div style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => void handleAdd()} disabled={saving}>
            {saving ? 'Saving…' : '+ Add Entry'}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th className="num">Actual</th>
              <th>Description</th>
              <th>Source Ref</th>
              <th>Recorded By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {MONTH_NAMES[r.period_month - 1]} {r.period_year}
                </td>
                <td className="num">{r.actual_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>{r.description || '—'}</td>
                <td>{r.source_reference || '—'}</td>
                <td>{r.recorded_by_name || '—'}</td>
                <td>
                  <button className="btn ghost" onClick={() => void handleDelete(r.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No actuals logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
