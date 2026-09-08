'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../lib/ToastContext';
import type { CommitteeMemberWithMeta } from './types';
import { isVacant } from './availability';
import { createPosition, deletePosition, saveStructure, updatePosition } from './useCommittee';

interface Props {
  open: boolean;
  onClose: () => void;
  members: CommitteeMemberWithMeta[];
  onRefresh: () => Promise<void>;
}

interface NewPositionForm {
  role: string;
  group_name: string;
  icon: string;
}

const EMPTY_NEW: NewPositionForm = { role: '', group_name: '', icon: '👤' };

function slugify(role: string): string {
  const base = role
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base || 'position'}_${Date.now().toString(36)}`;
}

export function PositionAdminModal({ open, onClose, members, onRefresh }: Props) {
  const toast = useToast();
  const [newPosition, setNewPosition] = useState<NewPositionForm>(EMPTY_NEW);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newPosition.role.trim()) {
      toast('Position title is required.');
      return;
    }
    try {
      await createPosition({
        id: slugify(newPosition.role),
        role: newPosition.role.trim(),
        group_name: newPosition.group_name.trim() || null,
        icon: newPosition.icon.trim() || null,
      });
      setNewPosition(EMPTY_NEW);
      await onRefresh();
      toast('Position created');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create position.');
    }
  };

  const handleFieldChange = async (
    member: CommitteeMemberWithMeta,
    field: 'role' | 'group_name' | 'icon',
    value: string
  ) => {
    setBusyId(member.id);
    try {
      await updatePosition(member.id, { [field]: value || null });
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update position.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStructureChange = async (
    member: CommitteeMemberWithMeta,
    parentId: string | null,
    displayOrder: number
  ) => {
    setBusyId(member.id);
    try {
      await saveStructure(member.id, member.data, parentId, displayOrder);
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update structure.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (member: CommitteeMemberWithMeta) => {
    const extra = !isVacant(member) ? ' This position is currently assigned.' : '';
    const hasChildren = members.some((m) => m.parentId === member.id);
    if (hasChildren && !confirm(`"${member.role}" has positions reporting to it. Delete anyway? They will move to top-level.${extra}`)) {
      return;
    }
    if (!hasChildren && !confirm(`Delete position "${member.role}"?${extra}`)) return;
    setBusyId(member.id);
    try {
      for (const child of members.filter((m) => m.parentId === member.id)) {
        await saveStructure(child.id, child.data, null, child.displayOrder);
      }
      await deletePosition(member.id);
      await onRefresh();
      toast('Position deleted');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete position.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Committee Structure & Positions" wide>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
        Administrator only. Reporting line ("Reports To") and Order control the org hierarchy shown on the
        roster.
      </p>

      <div className="form-grid" style={{ marginBottom: 18 }}>
        <div className="field">
          <label>New Position Title</label>
          <input value={newPosition.role} onChange={(e) => setNewPosition((v) => ({ ...v, role: e.target.value }))} />
        </div>
        <div className="field">
          <label>Group</label>
          <input
            value={newPosition.group_name}
            onChange={(e) => setNewPosition((v) => ({ ...v, group_name: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Icon</label>
          <input value={newPosition.icon} onChange={(e) => setNewPosition((v) => ({ ...v, icon: e.target.value }))} />
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={() => void handleCreate()}>
            + Add Position
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Group</th>
              <th>Icon</th>
              <th>Reports To</th>
              <th>Order</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <input
                    defaultValue={member.role}
                    disabled={busyId === member.id}
                    onBlur={(e) => e.target.value !== member.role && void handleFieldChange(member, 'role', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    defaultValue={member.group_name ?? ''}
                    disabled={busyId === member.id}
                    onBlur={(e) =>
                      e.target.value !== (member.group_name ?? '') && void handleFieldChange(member, 'group_name', e.target.value)
                    }
                  />
                </td>
                <td style={{ width: 60 }}>
                  <input
                    defaultValue={member.icon ?? ''}
                    disabled={busyId === member.id}
                    onBlur={(e) => e.target.value !== (member.icon ?? '') && void handleFieldChange(member, 'icon', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    defaultValue={member.parentId ?? ''}
                    disabled={busyId === member.id}
                    onChange={(e) => void handleStructureChange(member, e.target.value || null, member.displayOrder)}
                  >
                    <option value="">Top level</option>
                    {members
                      .filter((m) => m.id !== member.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.role}
                        </option>
                      ))}
                  </select>
                </td>
                <td style={{ width: 80 }}>
                  <input
                    type="number"
                    defaultValue={member.displayOrder}
                    disabled={busyId === member.id}
                    onBlur={(e) => void handleStructureChange(member, member.parentId, Number(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <button className="btn danger" disabled={busyId === member.id} onClick={() => void handleDelete(member)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="modal-actions">
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
