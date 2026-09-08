"use client";

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { EventRow } from '../../types/database';
import { EVENT_AUDIENCE_OPTIONS, type CommitteeMemberOption } from './types';
import { localTodayIso } from './lifecycle';

interface EventFormValues {
  name: string;
  event_type: string;
  audience_type: (typeof EVENT_AUDIENCE_OPTIONS)[number];
  event_date: string;
  event_time: string;
  venue: string;
  coordinator_id: string;
  expected_participants: number;
  planned_budget: number;
  description: string;
}

const EMPTY: EventFormValues = {
  name: '',
  event_type: '',
  audience_type: 'ALL_STAFF',
  event_date: localTodayIso(),
  event_time: '08:00',
  venue: '',
  coordinator_id: '',
  expected_participants: 0,
  planned_budget: 0,
  description: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (payload: Partial<EventRow>) => Promise<void>;
  eventTypes: string[];
  coordinators: CommitteeMemberOption[];
  editing?: EventRow | null;
}

export function EventFormModal({ open, onClose, onSave, eventTypes, coordinators, editing }: Props) {
  const [values, setValues] = useState<EventFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        name: editing.name,
        event_type: editing.event_type ?? '',
        audience_type: 'ALL_STAFF',
        event_date: editing.event_date ?? localTodayIso(),
        event_time: editing.event_time ?? '08:00',
        venue: editing.venue ?? '',
        coordinator_id: editing.coordinator_committee_id ?? '',
        expected_participants: editing.expected_participants,
        planned_budget: editing.planned_budget,
        description: editing.description ?? '',
      });
    } else {
      setValues(EMPTY);
    }
    setFormError(null);
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setFormError('Event name is required.');
      return;
    }
    if (!values.coordinator_id) {
      setFormError('Select a coordinator.');
      return;
    }
    const coordinator = coordinators.find((c) => c.id === values.coordinator_id);
    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        name: values.name.trim(),
        event_type: values.event_type || null,
        event_date: values.event_date || null,
        event_time: values.event_time || null,
        venue: values.venue || null,
        coordinator: coordinator?.name ?? null,
        coordinator_role: coordinator?.role ?? null,
        coordinator_committee_id: coordinator?.id ?? null,
        expected_participants: Number(values.expected_participants) || 0,
        planned_budget: Number(values.planned_budget) || 0,
        description: values.description || null,
        status: editing?.status ?? 'Planning',
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Event' : 'Create Event'}>
      <div className="form-grid">
        <div className="field full">
          <label>Event Name</label>
          <input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        </div>
        <div className="field">
          <label>Event Type</label>
          <select
            value={values.event_type}
            onChange={(e) => setValues((v) => ({ ...v, event_type: e.target.value }))}
          >
            <option value="">Select type</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Audience</label>
          <select
            value={values.audience_type}
            onChange={(e) =>
              setValues((v) => ({ ...v, audience_type: e.target.value as EventFormValues['audience_type'] }))
            }
          >
            {EVENT_AUDIENCE_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={values.event_date}
            onChange={(e) => setValues((v) => ({ ...v, event_date: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Time</label>
          <input
            type="time"
            value={values.event_time}
            onChange={(e) => setValues((v) => ({ ...v, event_time: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Venue</label>
          <input value={values.venue} onChange={(e) => setValues((v) => ({ ...v, venue: e.target.value }))} />
        </div>
        <div className="field">
          <label>Coordinator</label>
          <select
            value={values.coordinator_id}
            onChange={(e) => setValues((v) => ({ ...v, coordinator_id: e.target.value }))}
          >
            <option value="">Select coordinator</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Expected Participants</label>
          <input
            type="number"
            min={0}
            value={values.expected_participants}
            onChange={(e) => setValues((v) => ({ ...v, expected_participants: Number(e.target.value) }))}
          />
        </div>
        <div className="field">
          <label>Planned Budget</label>
          <input
            type="number"
            min={0}
            value={values.planned_budget}
            onChange={(e) => setValues((v) => ({ ...v, planned_budget: Number(e.target.value) }))}
          />
        </div>
        <div className="field full">
          <label>Description</label>
          <textarea
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </div>
      </div>
      {formError && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{formError}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Event'}
        </button>
      </div>
    </Modal>
  );
}