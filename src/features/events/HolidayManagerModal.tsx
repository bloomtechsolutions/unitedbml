'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../lib/ToastContext';
import type { HolidayType, PublicHolidayRow } from '../../types/database';
import { deleteHoliday, saveHoliday } from './useEventCalendar';

interface Props {
  open: boolean;
  onClose: () => void;
  holidays: PublicHolidayRow[];
  onSaved: () => Promise<void>;
}

const EMPTY = { date: '', name: '', type: 'Public' as HolidayType, notes: '' };

export function HolidayManagerModal({ open, onClose, holidays, onSaved }: Props) {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEditingId(null);
      setForm(EMPTY);
      setError(null);
    }
  }, [open]);

  const startEdit = (h: PublicHolidayRow) => {
    setEditingId(h.id);
    setForm({ date: h.holiday_date, name: h.name, type: h.type, notes: h.notes ?? '' });
  };

  const handleSave = async () => {
    if (!form.date || !form.name.trim()) {
      setError('Date and name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveHoliday(
        { holiday_date: form.date, name: form.name.trim(), type: form.type, notes: form.notes || null },
        editingId
      );
      await onSaved();
      setEditingId(null);
      setForm(EMPTY);
      toast(editingId ? 'Holiday updated.' : 'Holiday added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the holiday.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: PublicHolidayRow) => {
    if (!confirm(`Remove "${h.name}"?`)) return;
    try {
      await deleteHoliday(h.id);
      await onSaved();
      toast('Holiday removed.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove holiday.');
    }
  };

  const sorted = [...holidays].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));

  return (
    <Modal open={open} onClose={onClose} title="Manage Public Holidays" wide>
      <p style={{ fontSize: 12.5, color: 'var(--ub-ink-faint)', marginTop: -6, marginBottom: 14 }}>
        Maldives public holidays and observances shown on the Event Calendar. Islamic-calendar dates shift every
        year with moon sighting — update them here once officially confirmed.
      </p>

      <div style={{ border: '1px solid var(--ub-border)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{editingId ? 'Edit Holiday' : 'Add a Holiday'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Republic Day" />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as HolidayType }))}>
              <option value="Public">Public Holiday</option>
              <option value="Observance">Observance</option>
            </select>
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Notes</label>
          <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
        </div>
        {error && <div style={{ color: 'var(--danger)', marginTop: 8, fontSize: 13 }}>{error}</div>}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : '+ Add Holiday'}
          </button>
          {editingId && (
            <button
              className="btn ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Type</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.id}>
                <td>{h.holiday_date}</td>
                <td>{h.name}</td>
                <td>{h.type}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{h.notes || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn ghost" onClick={() => startEdit(h)}>
                      Edit
                    </button>
                    <button className="btn ghost" onClick={() => void handleDelete(h)}>
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No holidays recorded yet.
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
