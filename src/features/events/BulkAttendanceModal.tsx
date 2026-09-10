'use client';

import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../lib/ToastContext';
import type { StaffOption } from './types';
import { bulkAddAttendance, useActiveStaffDirectory } from './useEvents';

type Mode = 'department' | 'paste';

interface Props {
  open: boolean;
  eventId: string;
  existingUids: Set<string>;
  onClose: () => void;
  onAdded: () => Promise<void>;
}

export function BulkAttendanceModal({ open, eventId, existingUids, onClose, onAdded }: Props) {
  const { staff, loading } = useActiveStaffDirectory();
  const [mode, setMode] = useState<Mode>('department');
  const [department, setDepartment] = useState('');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [pasteText, setPasteText] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const departments = useMemo(
    () => Array.from(new Set(staff.map((s) => s.department).filter((d): d is string => !!d))).sort(),
    [staff]
  );
  const departmentStaff = useMemo(
    () => staff.filter((s) => !department || s.department === department),
    [staff, department]
  );

  const pasteMatches = useMemo(() => {
    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const matched: StaffOption[] = [];
    const unmatched: string[] = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      const exact = staff.find((s) => s.full_name.toLowerCase() === lower);
      const partial = exact ?? staff.find((s) => s.full_name.toLowerCase().includes(lower));
      if (partial) matched.push(partial);
      else unmatched.push(line);
    }
    return { matched, unmatched };
  }, [pasteText, staff]);

  if (!open) return null;

  const toggleUid = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleAddDepartment = async () => {
    const toAdd = departmentStaff.filter((s) => selectedUids.has(s.uid) && !existingUids.has(s.uid));
    if (!toAdd.length) {
      toast('No new staff selected.');
      return;
    }
    setSaving(true);
    try {
      await bulkAddAttendance(eventId, toAdd);
      await onAdded();
      toast(`Added ${toAdd.length} to the roster`);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add staff.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPasted = async () => {
    const toAdd = pasteMatches.matched.filter((s) => !existingUids.has(s.uid));
    if (!toAdd.length) {
      toast('No matched staff to add.');
      return;
    }
    setSaving(true);
    try {
      await bulkAddAttendance(eventId, toAdd);
      await onAdded();
      toast(`Added ${toAdd.length} to the roster${pasteMatches.unmatched.length ? `, ${pasteMatches.unmatched.length} unmatched` : ''}`);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add staff.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Bulk Add Participants" wide>
      <div className="ub-tabs" style={{ marginBottom: 16 }}>
        <button className={`ub-tab ${mode === 'department' ? 'active' : ''}`} onClick={() => setMode('department')}>
          By Department
        </button>
        <button className={`ub-tab ${mode === 'paste' ? 'active' : ''}`} onClick={() => setMode('paste')}>
          Paste Names
        </button>
      </div>

      {mode === 'department' && (
        <div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Department</label>
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setSelectedUids(new Set());
              }}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <small style={{ color: 'var(--ub-ink-faint)' }}>{loading ? 'Loading staff…' : `${departmentStaff.length} active staff`}</small>
            <button
              className="ub-btn ub-btn-ghost"
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() =>
                setSelectedUids(new Set(departmentStaff.filter((s) => !existingUids.has(s.uid)).map((s) => s.uid)))
              }
            >
              Select All
            </button>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--ub-border-2)', borderRadius: 10 }}>
            {departmentStaff.map((s) => {
              const already = existingUids.has(s.uid);
              return (
                <label
                  key={s.uid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--ub-border-2)',
                    opacity: already ? 0.5 : 1,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedUids.has(s.uid)}
                    disabled={already}
                    onChange={() => toggleUid(s.uid)}
                  />
                  {s.full_name} {already && <small style={{ color: 'var(--ub-ink-faint)' }}>(already on roster)</small>}
                </label>
              );
            })}
            {!departmentStaff.length && !loading && <div className="ub-empty">No active staff found.</div>}
          </div>
          <div className="modal-actions">
            <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="ub-btn ub-btn-primary" disabled={saving || !selectedUids.size} onClick={() => void handleAddDepartment()}>
              {saving ? 'Adding…' : `Add Selected (${selectedUids.size})`}
            </button>
          </div>
        </div>
      )}

      {mode === 'paste' && (
        <div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Paste staff names (one per line)</label>
            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'Ahmed Shaig\nFathimath Nahula\nHassan Adam'}
            />
          </div>
          {pasteText.trim() && (
            <div style={{ fontSize: 12.5, marginBottom: 12 }}>
              <div style={{ color: 'var(--ub-success-dark)' }}>Matched: {pasteMatches.matched.length}</div>
              {pasteMatches.unmatched.length > 0 && (
                <div style={{ color: 'var(--ub-danger-dark)' }}>Unmatched: {pasteMatches.unmatched.join(', ')}</div>
              )}
            </div>
          )}
          <div className="modal-actions">
            <button className="ub-btn ub-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="ub-btn ub-btn-primary" disabled={saving || !pasteMatches.matched.length} onClick={() => void handleAddPasted()}>
              {saving ? 'Adding…' : `Add Matched (${pasteMatches.matched.length})`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
