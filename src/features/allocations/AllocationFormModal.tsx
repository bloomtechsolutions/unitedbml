'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import type { AllocationCadence, StandingAllocationRow } from '../../types/database';
import { saveAllocation } from './useAllocations';

interface Props {
  open: boolean;
  onClose: () => void;
  allocation: StandingAllocationRow | null;
  onSaved: () => Promise<void>;
}

export function AllocationFormModal({ open, onClose, allocation, onSaved }: Props) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState<AllocationCadence>('Monthly');
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());
  const [allocatedAmount, setAllocatedAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(allocation?.name ?? '');
      setCadence(allocation?.cadence ?? 'Monthly');
      setBudgetYear(allocation?.budget_year ?? new Date().getFullYear());
      setAllocatedAmount(allocation?.allocated_amount ?? 0);
      setNotes(allocation?.notes ?? '');
      setError(null);
    }
  }, [open, allocation]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Enter an activity name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveAllocation(
        {
          name: name.trim(),
          cadence,
          budget_year: budgetYear,
          allocated_amount: allocatedAmount,
          notes: notes || null,
          active: allocation?.active ?? true,
        },
        allocation?.id ?? null,
        profile?.id
      );
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the activity.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={allocation ? 'Edit Standing Activity' : 'New Standing Activity'}>
      <div className="field">
        <label>Activity Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fun with Team" />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Cadence</label>
        <select value={cadence} onChange={(e) => setCadence(e.target.value as AllocationCadence)}>
          <option value="Monthly">Monthly (recurring, no fixed pool)</option>
          <option value="Annual">Annual (fund held at start of year)</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Budget Year</label>
        <input type="number" value={budgetYear} onChange={(e) => setBudgetYear(Number(e.target.value))} />
      </div>
      {cadence === 'Annual' && (
        <div className="field" style={{ marginTop: 12 }}>
          <label>Allocated Amount (MVR)</label>
          <input
            type="number"
            min={0}
            value={allocatedAmount}
            onChange={(e) => setAllocatedAmount(Number(e.target.value))}
          />
        </div>
      )}
      <div className="field" style={{ marginTop: 12 }}>
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Activity'}
        </button>
      </div>
    </Modal>
  );
}
