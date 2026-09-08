'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import type { ApBillRow, VendorMasterRow } from '../../types/database';
import { ATTACHMENT_MODES } from './types';
import type { ApBatchWithBills, AttachmentMode, ProcurementGroupCase } from './types';
import { apSubmittedTotal, saveApBatchDraft, sendApBatch, uploadBatchAttachment, useVendorSearch } from './useReimbursements';

type DraftBill = Omit<ApBillRow, 'id' | 'ap_batch_id'> & { _key: string; _file?: File };

function emptyBill(): DraftBill {
  return {
    _key: crypto.randomUUID(),
    line_no: 0,
    bill_date: '',
    vendor_number: null,
    vendor_name: null,
    worker_id: null,
    amount: 0,
    data: {},
  };
}

function VendorField({ bill, onChange }: { bill: DraftBill; onChange: (patch: Partial<DraftBill>) => void }) {
  const [query, setQuery] = useState(bill.vendor_name ?? '');
  const [open, setOpen] = useState(false);
  const results = useVendorSearch(query);

  const select = (v: VendorMasterRow) => {
    onChange({ vendor_number: v.vendor_account, vendor_name: v.name, worker_id: v.worker_id });
    setQuery(v.name);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        placeholder="Search vendor…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onChange({ vendor_number: null, vendor_name: e.target.value, worker_id: null });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10,
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 10,
            width: '100%',
            maxHeight: 160,
            overflowY: 'auto',
            boxShadow: 'var(--shadow)',
          }}
        >
          {results.map((v) => (
            <div
              key={v.vendor_account}
              onMouseDown={() => select(v)}
              style={{ padding: 8, cursor: 'pointer', fontSize: 12 }}
            >
              {v.name} — {v.vendor_account}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  caseItem: ProcurementGroupCase | null;
  existingBatch: ApBatchWithBills | null;
  batches: ApBatchWithBills[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ApBatchModal({ caseItem, existingBatch, batches, onClose, onSaved }: Props) {
  const [bills, setBills] = useState<DraftBill[]>([emptyBill()]);
  const [apEmail, setApEmail] = useState('');
  const [attachmentMode, setAttachmentMode] = useState<AttachmentMode>('Combined');
  const [combinedFile, setCombinedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingBatch) {
      setBills(
        existingBatch.bills.length
          ? existingBatch.bills.map((b) => ({ ...b, _key: b.id }))
          : [emptyBill()]
      );
      setApEmail(existingBatch.ap_email ?? '');
    } else {
      setBills([emptyBill()]);
      setApEmail('');
    }
    setCombinedFile(null);
    setError(null);
  }, [existingBatch, caseItem]);

  if (!caseItem) return null;

  const remaining = caseItem.approved_item_amount - apSubmittedTotal(batches, caseItem.id);
  const billsTotal = bills.reduce((sum, b) => sum + (b.amount || 0), 0);

  const updateBill = (key: string, patch: Partial<DraftBill>) => {
    setBills((prev) => prev.map((b) => (b._key === key ? { ...b, ...patch } : b)));
  };

  const handleSaveDraft = async (send: boolean) => {
    if (billsTotal > remaining + 0.01) {
      setError(`Total bills (${billsTotal.toLocaleString()}) exceed the remaining approved balance (${remaining.toLocaleString()}).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const batchId = await saveApBatchDraft(
        existingBatch?.id ?? null,
        caseItem.id,
        bills.map(({ _key: _k, _file: _f, ...b }) => b),
        apEmail
      );

      if (attachmentMode === 'Combined' && combinedFile) {
        await uploadBatchAttachment(batchId, 'Combined', combinedFile);
      }
      for (const bill of bills) {
        if (attachmentMode === 'Individual' && bill._file) {
          const { data: refreshed } = await supabase
            .from('ap_bills')
            .select('id')
            .eq('ap_batch_id', batchId)
            .eq('line_no', bills.indexOf(bill) + 1)
            .single();
          if (refreshed) {
            const path = await uploadBatchAttachment(batchId, 'Individual', bill._file, refreshed.id);
            await supabase
              .from('ap_bills')
              .update({ data: { ...bill.data, attachmentPath: path, attachmentName: bill._file.name } })
              .eq('id', refreshed.id);
          }
        }
      }

      if (send) {
        const { data: freshBatch } = await supabase.from('ap_batches').select('*').eq('id', batchId).single();
        const { data: freshBills } = await supabase.from('ap_bills').select('*').eq('ap_batch_id', batchId);
        if (freshBatch) {
          await sendApBatch({ ...freshBatch, bills: freshBills ?? [] }, attachmentMode);
        }
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AP batch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`AP Batch — ${caseItem.expense_item}`} wide>
      <div className="ap-summary">
        <div className="mini">
          <small>Approved</small>
          <strong>{caseItem.approved_item_amount.toLocaleString()}</strong>
        </div>
        <div className="mini">
          <small>Remaining</small>
          <strong>{remaining.toLocaleString()}</strong>
        </div>
        <div className="mini">
          <small>This Batch</small>
          <strong>{billsTotal.toLocaleString()}</strong>
        </div>
        <div className="mini">
          <small>Attachment Mode</small>
          <select value={attachmentMode} onChange={(e) => setAttachmentMode(e.target.value as AttachmentMode)}>
            {ATTACHMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {bills.map((bill) => (
        <div key={bill._key} className="ap-bill-row">
          <div className="field">
            <label>Bill Date</label>
            <input type="date" value={bill.bill_date ?? ''} onChange={(e) => updateBill(bill._key, { bill_date: e.target.value })} />
          </div>
          <div className="field">
            <label>Vendor</label>
            <VendorField bill={bill} onChange={(patch) => updateBill(bill._key, patch)} />
          </div>
          <div className="field">
            <label>Worker ID</label>
            <input value={bill.worker_id ?? ''} readOnly />
          </div>
          <div className="field">
            <label>Amount</label>
            <input type="number" min={0} value={bill.amount} onChange={(e) => updateBill(bill._key, { amount: Number(e.target.value) })} />
          </div>
          {attachmentMode === 'Individual' && (
            <div className="field">
              <label>Attachment</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => updateBill(bill._key, { _file: e.target.files?.[0] })}
              />
              {bill._file && <div className="ap-bill-file">{bill._file.name}</div>}
            </div>
          )}
          <button className="btn danger" onClick={() => setBills((prev) => prev.filter((b) => b._key !== bill._key))}>
            Remove
          </button>
        </div>
      ))}
      <button className="btn ghost" onClick={() => setBills((prev) => [...prev, emptyBill()])}>
        + Add Bill
      </button>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <div className="field">
          <label>AP Email</label>
          <input type="email" value={apEmail} onChange={(e) => setApEmail(e.target.value)} />
        </div>
        {attachmentMode === 'Combined' && (
          <div className="field">
            <label>Combined Bills Attachment</label>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setCombinedFile(e.target.files?.[0] ?? null)} />
          </div>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn soft" onClick={() => void handleSaveDraft(false)} disabled={saving}>
          Save Draft
        </button>
        <button className="btn primary" onClick={() => void handleSaveDraft(true)} disabled={saving}>
          {saving ? 'Sending…' : 'Save & Send to AP'}
        </button>
      </div>
    </Modal>
  );
}
