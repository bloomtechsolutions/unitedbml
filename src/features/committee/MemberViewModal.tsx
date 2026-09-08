'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { CommitteeMemberRow } from '../../types/database';
import { committeeEffectiveAvailability } from './availability';
import { fetchMemberStaffProfile } from './useCommittee';
import type { StaffProfilePreview } from './types';

interface Props {
  member: CommitteeMemberRow | null;
  onClose: () => void;
  onEdit: (member: CommitteeMemberRow) => void;
}

export function MemberViewModal({ member, onClose, onEdit }: Props) {
  const [preview, setPreview] = useState<StaffProfilePreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!member) return;
    setPreview(null);
    setLoading(true);
    fetchMemberStaffProfile(member.id)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [member]);

  if (!member) return null;

  const effective = committeeEffectiveAvailability(member);

  return (
    <Modal open onClose={onClose} title={member.role}>
      <div className="committee-info-grid">
        <div className="committee-info">
          <small>Member</small>
          <b>{member.name || 'Vacant'}</b>
        </div>
        <div className="committee-info">
          <small>Contact</small>
          <b>{member.contact || '—'}</b>
        </div>
        <div className="committee-info">
          <small>Email</small>
          <b>{member.email || '—'}</b>
        </div>
        <div className="committee-info">
          <small>Status</small>
          <b>{member.status}</b>
        </div>
        <div className="committee-info">
          <small>Availability</small>
          <b>{effective}</b>
        </div>
        <div className="committee-info">
          <small>Term</small>
          <b>
            {member.term_start || '—'} → {member.term_end || '—'}
          </b>
        </div>
      </div>

      {loading && <div className="committee-loading">Loading Staff Master profile…</div>}
      {preview && (
        <div className="committee-member-preview">
          <div className="mini">
            <small>Job Title</small>
            <b>{preview.jobTitle || '—'}</b>
          </div>
          <div className="mini">
            <small>Division</small>
            <b>{preview.division || '—'}</b>
          </div>
          <div className="mini">
            <small>Department</small>
            <b>{preview.department || '—'}</b>
          </div>
          <div className="mini">
            <small>Unit</small>
            <b>{preview.unit || '—'}</b>
          </div>
          <div className="mini">
            <small>Audience Category</small>
            <b>{preview.audienceCategory || '—'}</b>
          </div>
        </div>
      )}

      {member.notes && (
        <p style={{ marginTop: 14, fontSize: 13 }}>
          <b>Notes:</b> {member.notes}
        </p>
      )}

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
        <button className="btn primary" onClick={() => onEdit(member)}>
          Edit Member
        </button>
      </div>
    </Modal>
  );
}
