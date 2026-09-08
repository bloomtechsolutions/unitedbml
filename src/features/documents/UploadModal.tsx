'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { DOCUMENT_CATEGORIES } from './types';
import { uploadDocument, useEventOptions } from './useDocuments';

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded: () => Promise<void>;
}

export function UploadModal({ open, onClose, onUploaded }: Props) {
  const { profile } = useAuth();
  const events = useEventOptions();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('GENERAL');
  const [eventId, setEventId] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim() || !file) {
      setError('Title and a file are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const event = events.find((e) => e.id === eventId);
      await uploadDocument(
        { title: title.trim(), category, eventId: eventId || null, eventName: event?.name ?? null, notes },
        file,
        { id: profile?.id ?? '', name: profile?.full_name || profile?.email || 'Unknown' }
      );
      setTitle('');
      setCategory('GENERAL');
      setEventId('');
      setNotes('');
      setFile(null);
      await onUploaded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Upload Document">
      <div className="form-grid">
        <div className="field full">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Event / Activity (optional)</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">General / Not linked</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>File (max 25 MB, stored privately)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="field full">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </Modal>
  );
}
