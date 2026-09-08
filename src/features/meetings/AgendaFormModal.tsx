'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { CommitteeMemberOption } from '../events/types';
import type { MeetingAgendaRow } from '../../types/database';
import type { RequiredItem } from './types';

interface Values {
  title: string;
  owner: string;
  minutes_allocated: number;
  outcome: string;
  details: string;
  discussion: string;
  requiredItems: RequiredItem[];
}

const EMPTY: Values = { title: '', owner: '', minutes_allocated: 10, outcome: '', details: '', discussion: '', requiredItems: [] };

function emptyItem(): RequiredItem {
  return { id: crypto.randomUUID(), description: '', category: '', estimatedAmount: 0, reimbursable: true };
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing: MeetingAgendaRow | null;
  coordinators: CommitteeMemberOption[];
  nextSortOrder: number;
  onSave: (payload: Partial<MeetingAgendaRow>) => Promise<void>;
}

export function AgendaFormModal({ open, onClose, editing, coordinators, nextSortOrder, onSave }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const existingItems = (editing.data as { requiredItems?: RequiredItem[] } | null)?.requiredItems ?? [];
      setValues({
        title: editing.title,
        owner: editing.owner ?? '',
        minutes_allocated: editing.minutes_allocated,
        outcome: editing.outcome ?? '',
        details: editing.details ?? '',
        discussion: editing.discussion ?? '',
        requiredItems: existingItems,
      });
    } else {
      setValues(EMPTY);
    }
    setError(null);
  }, [open, editing]);

  const updateItem = (id: string, patch: Partial<RequiredItem>) => {
    setValues((v) => ({ ...v, requiredItems: v.requiredItems.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  };

  const removeItem = (id: string) => {
    setValues((v) => ({ ...v, requiredItems: v.requiredItems.filter((it) => it.id !== id) }));
  };

  const handleSubmit = async () => {
    if (!values.title.trim()) {
      setError('Agenda title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const cleanItems = values.requiredItems
        .map((it) => ({ ...it, description: it.description.trim() }))
        .filter((it) => it.description);
      await onSave({
        title: values.title.trim(),
        owner: values.owner || null,
        minutes_allocated: Number(values.minutes_allocated) || 0,
        outcome: values.outcome || null,
        details: values.details || null,
        discussion: values.discussion || null,
        sort_order: editing?.sort_order ?? nextSortOrder,
        data: { ...(editing?.data ?? {}), requiredItems: cleanItems },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agenda item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Agenda Item' : 'Add Agenda Item'}>
      <div className="form-grid">
        <div className="field full">
          <label>Title</label>
          <input value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} />
        </div>
        <div className="field">
          <label>Owner</label>
          <select value={values.owner} onChange={(e) => setValues((v) => ({ ...v, owner: e.target.value }))}>
            <option value="">Unassigned</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.name ?? ''}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Minutes Allocated</label>
          <input
            type="number"
            min={0}
            value={values.minutes_allocated}
            onChange={(e) => setValues((v) => ({ ...v, minutes_allocated: Number(e.target.value) }))}
          />
        </div>
        <div className="field full">
          <label>Outcome</label>
          <input
            list="agenda-outcomes"
            value={values.outcome}
            onChange={(e) => setValues((v) => ({ ...v, outcome: e.target.value }))}
            placeholder="e.g. Approved, Noted, Create Event / Activity"
          />
          <datalist id="agenda-outcomes">
            <option value="Approved" />
            <option value="Noted" />
            <option value="Deferred" />
            <option value="Rejected" />
            <option value="Create Event / Activity" />
          </datalist>
        </div>
        <div className="field full">
          <label>Details</label>
          <textarea value={values.details} onChange={(e) => setValues((v) => ({ ...v, details: e.target.value }))} />
        </div>
        <div className="field full">
          <label>Discussion</label>
          <textarea
            value={values.discussion}
            onChange={(e) => setValues((v) => ({ ...v, discussion: e.target.value }))}
          />
        </div>
      </div>

      <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--ub-border)' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ub-ink-soft)', marginBottom: 4 }}>
          Items required for the event{values.requiredItems.length > 0 ? ` (${values.requiredItems.length})` : ''}
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ub-ink-faint)' }}>
          Optional — only matters if this item becomes an event. Listed here so they carry onto the event, and pre-fill its
          Expense Request line items automatically. You don't need to set Outcome first.
        </p>
        {values.requiredItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {values.requiredItems.map((item) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
                <input
                  placeholder="Item description"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                />
                <input
                  placeholder="Category"
                  value={item.category}
                  onChange={(e) => updateItem(item.id, { category: e.target.value })}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Est. amount"
                  value={item.estimatedAmount || ''}
                  onChange={(e) => updateItem(item.id, { estimatedAmount: Number(e.target.value) })}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={item.reimbursable} onChange={(e) => updateItem(item.id, { reimbursable: e.target.checked })} />
                  Reimbursable
                </label>
                <button className="ub-btn ub-btn-danger" style={{ padding: '7px 10px', fontSize: 12 }} onClick={() => removeItem(item.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          className="ub-btn ub-btn-ghost"
          style={{ marginTop: 10, padding: '8px 14px', fontSize: 12.5 }}
          onClick={() => setValues((v) => ({ ...v, requiredItems: [...v.requiredItems, emptyItem()] }))}
        >
          + Add item
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Agenda Item'}
        </button>
      </div>
    </Modal>
  );
}
