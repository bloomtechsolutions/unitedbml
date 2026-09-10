'use client';

import { useState } from 'react';
import { useToast } from '../../lib/ToastContext';
import { generateApprovedExpenseNotePdf, openGeneratedAttachment } from '../../lib/expenseNotePdf';
import type { ExpenseRequestWithLines } from './types';

const STAGES = ['Inputter', 'President Recommendation', 'Email Final Approval', 'Approved'] as const;

function stageIndex(status: string): number {
  if (status === 'Pending President Recommendation') return 0;
  if (status === 'Pending Final Approval') return 1;
  if (status === 'Approved') return 3;
  return 0;
}

interface Props {
  request: ExpenseRequestWithLines;
  onOpen: () => void;
  onRequestReversal: () => void;
  settlementStatus?: string;
  onEnterActual?: () => void;
}

export function RequestCard({ request, onOpen, onRequestReversal, settlementStatus, onEnterActual }: Props) {
  const toast = useToast();
  const [generatingNote, setGeneratingNote] = useState(false);

  const terminal = ['Rejected', 'Cancelled', 'Reversed', 'Draft'].includes(request.status);
  const idx = stageIndex(request.status);

  const handleApprovalNote = async () => {
    setGeneratingNote(true);
    try {
      openGeneratedAttachment(await generateApprovedExpenseNotePdf(request.id));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to generate approval note.');
    } finally {
      setGeneratingNote(false);
    }
  };

  return (
    <div className="reimb-card" style={{ borderLeft: '3px solid var(--primary, #2563eb)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <small style={{ color: 'var(--muted)' }}>{request.request_number}</small>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{request.title || request.request_number}</div>
          <small style={{ color: 'var(--muted)' }}>
            {request.request_date} · {request.requested_by} · {request.event_name || 'General Club Expense'}
          </small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700 }}>MVR {request.total_amount.toLocaleString()}</div>
          <span className={`pill ${request.status === 'Approved' ? 'done' : request.status === 'Rejected' ? 'cancel' : 'plan'}`}>
            {request.status}
          </span>
        </div>
      </div>

      {!terminal && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
          {STAGES.map((s, i) => (
            <span key={s} className={`pill ${i <= idx ? 'done' : 'plan'}`} style={{ fontSize: 10.5 }}>
              {s}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button className="btn ghost" onClick={onOpen}>
          Open
        </button>
        {request.status === 'Approved' && (
          <button className="btn soft" disabled={generatingNote} onClick={() => void handleApprovalNote()}>
            {generatingNote ? 'Generating…' : 'Approval Note'}
          </button>
        )}
        {request.status === 'Approved' && settlementStatus && settlementStatus !== 'Closed' && onEnterActual && (
          <button className="btn primary" onClick={onEnterActual}>
            Enter Actual / Settle
          </button>
        )}
        {request.status === 'Approved' && !request.reversal_status && (
          <button className="btn danger" onClick={onRequestReversal}>
            Request Reversal
          </button>
        )}
      </div>
    </div>
  );
}
