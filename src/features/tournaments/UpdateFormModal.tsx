'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/AuthContext';
import { postUpdate } from './useTournaments';

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  onSaved: () => Promise<void>;
}

export function UpdateFormModal({ open, onClose, tournamentId, onSaved }: Props) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await postUpdate({
        tournament_id: tournamentId,
        title: title.trim(),
        message: message.trim(),
        is_pinned: pinned,
        update_type: 'Update',
        created_by_name: profile?.full_name || profile?.email || 'Committee',
      });
      setTitle('');
      setMessage('');
      setPinned(false);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post update.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Post Update">
      <div className="form-grid">
        <div className="field full">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field full">
          <label>Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="field">
          <label>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} style={{ marginRight: 6 }} />
            Pin to top
          </label>
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Posting…' : 'Post Update'}
        </button>
      </div>
    </Modal>
  );
}
